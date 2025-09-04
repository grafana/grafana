package conversion

import (
	"errors"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/conversion"

	"github.com/grafana/grafana-app-sdk/logging"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

var logger = logging.DefaultLogger.With("logger", "dashboard.conversion")

// getErroredSchemaVersionFunc determines the schema version function that errored
func getErroredSchemaVersionFunc(err error) string {
	var migrationErr *schemaversion.MigrationError
	if errors.As(err, &migrationErr) {
		return migrationErr.GetFunctionName()
	}
	return ""
}

// getErroredConversionFunc determines the conversion function that errored
func getErroredConversionFunc(err error) string {
	var conversionErr *ConversionError
	if errors.As(err, &conversionErr) {
		return conversionErr.GetFunctionName()
	}

	var migrationErr *schemaversion.MigrationError
	if errors.As(err, &migrationErr) {
		return migrationErr.GetFunctionName()
	}

	return ""
}

// convertAPIVersionToFuncName converts API version to function name format
func convertAPIVersionToFuncName(apiVersion string) string {
	// Convert dashboard.grafana.app/v0alpha1 to v0alpha1
	if idx := strings.LastIndex(apiVersion, "/"); idx != -1 {
		apiVersion = apiVersion[idx+1:]
	}

	// Map API versions to function name format
	switch apiVersion {
	case "v0alpha1":
		return "V0"
	case "v1beta1":
		return "V1"
	case "v2alpha1":
		return "V2alpha1"
	case "v2beta1":
		return "V2beta1"
	default:
		return apiVersion
	}
}

// withConversionMetrics wraps a conversion function with metrics and logging for the overall conversion process
func withConversionMetrics(sourceVersionAPI, targetVersionAPI string, conversionFunc func(a, b interface{}, scope conversion.Scope) error) func(a, b interface{}, scope conversion.Scope) error {
	return func(a, b interface{}, scope conversion.Scope) error {
		// Extract dashboard UID and schema version from source
		var dashboardUID string
		var sourceSchemaVersion interface{}
		var targetSchemaVersion interface{}

		// Try to extract UID and schema version from source dashboard
		// Only track schema versions for v0/v1 dashboards (v2+ info is redundant with API version)
		switch source := a.(type) {
		case *dashv0.Dashboard:
			dashboardUID = string(source.UID)
			if source.Spec.Object != nil {
				sourceSchemaVersion = schemaversion.GetSchemaVersion(source.Spec.Object)
			}
		case *dashv1.Dashboard:
			dashboardUID = string(source.UID)
			if source.Spec.Object != nil {
				sourceSchemaVersion = schemaversion.GetSchemaVersion(source.Spec.Object)
			}
		case *dashv2alpha1.Dashboard:
			dashboardUID = string(source.UID)
			// Don't track schema version for v2+ (redundant with API version)
		case *dashv2beta1.Dashboard:
			dashboardUID = string(source.UID)
			// Don't track schema version for v2+ (redundant with API version)
		}

		// Determine target schema version based on target type
		// Only for v0/v1 dashboards
		switch b.(type) {
		case *dashv0.Dashboard:
			if sourceSchemaVersion != nil {
				targetSchemaVersion = sourceSchemaVersion // V0 keeps source schema version
			}
		case *dashv1.Dashboard:
			if sourceSchemaVersion != nil {
				targetSchemaVersion = schemaversion.LATEST_VERSION // V1 migrates to latest
			}
		case *dashv2alpha1.Dashboard:
			// Don't track schema version for v2+ (redundant with API version)
		case *dashv2beta1.Dashboard:
			// Don't track schema version for v2+ (redundant with API version)
		}

		// Execute the actual conversion
		err := conversionFunc(a, b, scope)

		// Report conversion-level metrics and logs
		if err != nil {
			// Classify error type for metrics
			errorType := "conversion_error"
			var migrationErr *schemaversion.MigrationError
			var minVersionErr *schemaversion.MinimumVersionError
			if errors.As(err, &migrationErr) {
				errorType = "schema_version_migration_error"
			} else if errors.As(err, &minVersionErr) {
				errorType = "schema_minimum_version_error"
			}

			// Record failure metrics
			sourceSchemaStr := ""
			targetSchemaStr := ""
			if sourceSchemaVersion != nil {
				sourceSchemaStr = fmt.Sprintf("%v", sourceSchemaVersion)
			}
			if targetSchemaVersion != nil {
				targetSchemaStr = fmt.Sprintf("%v", targetSchemaVersion)
			}

			migration.MDashboardConversionFailureTotal.WithLabelValues(
				sourceVersionAPI,
				targetVersionAPI,
				sourceSchemaStr,
				targetSchemaStr,
				errorType,
			).Inc()

			// Log failure - use warning for schema_minimum_version_error, error for others
			// Build base log fields
			logFields := []interface{}{
				"sourceVersionAPI", sourceVersionAPI,
				"targetVersionAPI", targetVersionAPI,
				"erroredConversionFunc", getErroredConversionFunc(err),
				"dashboardUID", dashboardUID,
			}

			// Add schema version fields only if we have them (v0/v1 dashboards)
			if sourceSchemaVersion != nil && targetSchemaVersion != nil {
				logFields = append(logFields,
					"sourceSchemaVersion", sourceSchemaVersion,
					"targetSchemaVersion", targetSchemaVersion,
					"erroredSchemaVersionFunc", getErroredSchemaVersionFunc(err),
				)
			}

			// Add remaining fields
			logFields = append(logFields,
				"errorType", errorType,
				"error", err,
			)

			if errorType == "schema_minimum_version_error" {
				logger.Warn("Dashboard conversion failed", logFields...)
			} else {
				logger.Error("Dashboard conversion failed", logFields...)
			}
		} else {
			// Record success metrics
			sourceSchemaStr := ""
			targetSchemaStr := ""
			if sourceSchemaVersion != nil {
				sourceSchemaStr = fmt.Sprintf("%v", sourceSchemaVersion)
			}
			if targetSchemaVersion != nil {
				targetSchemaStr = fmt.Sprintf("%v", targetSchemaVersion)
			}

			migration.MDashboardConversionSuccessTotal.WithLabelValues(
				sourceVersionAPI,
				targetVersionAPI,
				sourceSchemaStr,
				targetSchemaStr,
			).Inc()

			// Log success (debug level to avoid spam)
			// Build base log fields for success
			successLogFields := []interface{}{
				"sourceVersionAPI", sourceVersionAPI,
				"targetVersionAPI", targetVersionAPI,
				"dashboardUID", dashboardUID,
			}

			// Add schema version fields only if we have them (v0/v1 dashboards)
			if sourceSchemaVersion != nil && targetSchemaVersion != nil {
				successLogFields = append(successLogFields,
					"sourceSchemaVersion", sourceSchemaVersion,
					"targetSchemaVersion", targetSchemaVersion,
				)
			}

			logger.Debug("Dashboard conversion succeeded", successLogFields...)
		}

		return err
	}
}

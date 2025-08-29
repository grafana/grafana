package conversion

import (
	"errors"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

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

// getErroredVersionAPIFunc determines the API version conversion function that errored
func getErroredVersionAPIFunc(sourceVersionAPI, targetVersionAPI string) string {
	return fmt.Sprintf("%s_to_%s",
		convertAPIVersionToFuncName(sourceVersionAPI),
		convertAPIVersionToFuncName(targetVersionAPI))
}

// convertAPIVersionToFuncName converts API version to function name format
func convertAPIVersionToFuncName(apiVersion string) string {
	// Convert dashboard.grafana.app/v0alpha1 to v0alpha1
	if idx := strings.LastIndex(apiVersion, "/"); idx != -1 {
		return apiVersion[idx+1:]
	}
	return apiVersion
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
				"erroredVersionAPIFunc", getErroredVersionAPIFunc(sourceVersionAPI, targetVersionAPI),
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

func RegisterConversions(s *runtime.Scheme) error {
	// v0 conversions
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V1(a.(*dashv0.Dashboard), b.(*dashv1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv2alpha1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V2alpha1(a.(*dashv0.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2beta1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv2beta1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V2beta1(a.(*dashv0.Dashboard), b.(*dashv2beta1.Dashboard), scope)
		})); err != nil {
		return err
	}

	// v1 conversions
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv0.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv0.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1_to_V0(a.(*dashv1.Dashboard), b.(*dashv0.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv2alpha1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1_to_V2alpha1(a.(*dashv1.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2beta1.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv2beta1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1_to_V2beta1(a.(*dashv1.Dashboard), b.(*dashv2beta1.Dashboard), scope)
		})); err != nil {
		return err
	}

	// v2alpha1 conversions
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv0.Dashboard)(nil),
		withConversionMetrics(dashv2alpha1.APIVERSION, dashv0.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2alpha1_to_V0(a.(*dashv2alpha1.Dashboard), b.(*dashv0.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv1.Dashboard)(nil),
		withConversionMetrics(dashv2alpha1.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2alpha1_to_V1(a.(*dashv2alpha1.Dashboard), b.(*dashv1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv2beta1.Dashboard)(nil),
		withConversionMetrics(dashv2alpha1.APIVERSION, dashv2beta1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2alpha1_to_V2beta1(a.(*dashv2alpha1.Dashboard), b.(*dashv2beta1.Dashboard), scope)
		})); err != nil {
		return err
	}

	// v2beta1 conversions
	if err := s.AddConversionFunc((*dashv2beta1.Dashboard)(nil), (*dashv0.Dashboard)(nil),
		withConversionMetrics(dashv2beta1.APIVERSION, dashv0.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2beta1_to_V0(a.(*dashv2beta1.Dashboard), b.(*dashv0.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2beta1.Dashboard)(nil), (*dashv1.Dashboard)(nil),
		withConversionMetrics(dashv2beta1.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2beta1_to_V1(a.(*dashv2beta1.Dashboard), b.(*dashv1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2beta1.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil),
		withConversionMetrics(dashv2beta1.APIVERSION, dashv2alpha1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2beta1_to_V2alpha1(a.(*dashv2beta1.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
		})); err != nil {
		return err
	}

	return nil
}

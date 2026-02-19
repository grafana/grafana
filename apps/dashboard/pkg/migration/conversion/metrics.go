package conversion

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/conversion"

	"github.com/grafana/grafana-app-sdk/logging"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func getLogger() logging.Logger {
	return logging.DefaultLogger.With("logger", "dashboard.conversion")
}

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

	var dataLossErr *ConversionDataLossError
	if errors.As(err, &dataLossErr) {
		return dataLossErr.GetFunctionName()
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

// dashboardInfo holds extracted dashboard metadata for metrics
type dashboardInfo struct {
	uid             string
	sourceSchema    interface{}
	targetSchema    interface{}
	sourceSchemaStr string
	targetSchemaStr string
}

// extractDashboardInfo extracts UID and schema versions from source and target dashboards
func extractDashboardInfo(a, b interface{}) dashboardInfo {
	info := dashboardInfo{}

	// get uid and schema version from source
	switch source := a.(type) {
	case *dashv0.Dashboard:
		info.uid = source.Name
		if source.Spec.Object != nil {
			info.sourceSchema = schemaversion.GetSchemaVersion(source.Spec.Object)
		}
	case *dashv1.Dashboard:
		info.uid = source.Name
		if source.Spec.Object != nil {
			info.sourceSchema = schemaversion.GetSchemaVersion(source.Spec.Object)
		}
	case *dashv2alpha1.Dashboard:
		info.uid = source.Name
	case *dashv2beta1.Dashboard:
		info.uid = source.Name
	}

	// determine target schema version
	switch b.(type) {
	case *dashv0.Dashboard:
		if info.sourceSchema != nil {
			info.targetSchema = info.sourceSchema // V0 keeps source schema version
		}
	case *dashv1.Dashboard:
		if info.sourceSchema != nil {
			info.targetSchema = schemaversion.LATEST_VERSION // V1 migrates to latest
		}
	}

	if info.sourceSchema != nil {
		info.sourceSchemaStr = fmt.Sprintf("%v", info.sourceSchema)
	}
	if info.targetSchema != nil {
		info.targetSchemaStr = fmt.Sprintf("%v", info.targetSchema)
	}

	return info
}

// classifyConversionError determines the error type for metrics
func classifyConversionError(err error) string {
	var migrationErr *schemaversion.MigrationError
	var minVersionErr *schemaversion.MinimumVersionError
	var dataLossErr *ConversionDataLossError

	switch {
	case errors.As(err, &migrationErr):
		return "schema_version_migration_error"
	case errors.As(err, &minVersionErr):
		return "schema_minimum_version_error"
	case errors.As(err, &dataLossErr):
		return "conversion_data_loss_error"
	default:
		return "conversion_error"
	}
}

// buildErrorLogFields builds log fields for conversion errors
func buildErrorLogFields(sourceVersionAPI, targetVersionAPI, errorType string, err error, info dashboardInfo, a, b interface{}) []interface{} {
	logFields := []interface{}{
		"sourceVersionAPI", sourceVersionAPI,
		"targetVersionAPI", targetVersionAPI,
		"erroredConversionFunc", getErroredConversionFunc(err),
		"dashboardUID", info.uid,
	}

	// add schema version fields only if we have them (v0/v1 dashboards)
	if info.sourceSchema != nil && info.targetSchema != nil {
		logFields = append(logFields,
			"sourceSchemaVersion", info.sourceSchema,
			"targetSchemaVersion", info.targetSchema,
			"erroredSchemaVersionFunc", getErroredSchemaVersionFunc(err),
		)
	}

	// add data loss specific fields if this is a data loss error
	if errorType == "conversion_data_loss_error" {
		sourceStats := collectDashboardStats(a)
		targetStats := collectDashboardStats(b)
		logFields = append(logFields,
			"panelsLost", math.Max(0, float64(sourceStats.panelCount-targetStats.panelCount)),
			"queriesLost", math.Max(0, float64(sourceStats.queryCount-targetStats.queryCount)),
			"annotationsLost", math.Max(0, float64(sourceStats.annotationCount-targetStats.annotationCount)),
			"linksLost", math.Max(0, float64(sourceStats.linkCount-targetStats.linkCount)),
			"variablesLost", math.Max(0, float64(sourceStats.variableCount-targetStats.variableCount)),
		)
	}

	logFields = append(logFields, "errorType", errorType, "error", err)
	return logFields
}

// buildSuccessLogFields builds log fields for successful conversions
func buildSuccessLogFields(sourceVersionAPI, targetVersionAPI string, info dashboardInfo) []interface{} {
	logFields := []interface{}{
		"sourceVersionAPI", sourceVersionAPI,
		"targetVersionAPI", targetVersionAPI,
		"dashboardUID", info.uid,
	}

	// add schema version fields only if we have them (v0/v1 dashboards)
	if info.sourceSchema != nil && info.targetSchema != nil {
		logFields = append(logFields,
			"sourceSchemaVersion", info.sourceSchema,
			"targetSchemaVersion", info.targetSchema,
		)
	}

	return logFields
}

// scopeWithContext wraps conversion.Scope to pass tracing context to child conversion functions to allow tracing to work properly
type scopeWithContext struct {
	conversion.Scope
	ctx context.Context
}

// preserve everything but context
func (s *scopeWithContext) Meta() *conversion.Meta {
	if s.Scope != nil && s.Scope.Meta() != nil {
		meta := *s.Scope.Meta()
		meta.Context = s.ctx
		return &meta
	}
	return &conversion.Meta{Context: s.ctx}
}

// withConversionMetrics wraps a conversion function with metrics and logging for the overall conversion process
// it also runs a data loss check function after successful conversion
func withConversionMetrics(sourceVersionAPI, targetVersionAPI string, conversionFunc func(a, b interface{}, scope conversion.Scope) error) func(a, b interface{}, scope conversion.Scope) error {
	return func(a, b interface{}, scope conversion.Scope) error {
		// if available, use parent scope so tracing works, otherwise use background
		ctx := context.Background()
		if scope != nil && scope.Meta() != nil && scope.Meta().Context != nil {
			if scopeCtx, ok := scope.Meta().Context.(context.Context); ok {
				ctx = scopeCtx
			}
		}

		tracer := otel.GetTracerProvider().Tracer("dashboard-converter")
		ctx, span := tracer.Start(ctx, "dashboard.conversion",
			trace.WithAttributes(
				attribute.String("source.api_version", sourceVersionAPI),
				attribute.String("target.api_version", targetVersionAPI),
			),
		)
		defer span.End()

		info := extractDashboardInfo(a, b)

		span.SetAttributes(attribute.String("dashboard.uid", info.uid))
		if schemaVer, ok := info.sourceSchema.(float64); ok {
			span.SetAttributes(attribute.Int("source.schema_version", int(schemaVer)))
		}

		// wrape scope so we can pass context with span to child conversion functions
		wrappedScope := &scopeWithContext{
			Scope: scope,
			ctx:   ctx,
		}

		// execute the actual conversion
		err := conversionFunc(a, b, wrappedScope)

		// if conversion succeeded, run data loss check
		if err == nil {
			err = checkConversionDataLoss(sourceVersionAPI, targetVersionAPI, a, b)
		}

		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "conversion successful")
		}

		if err != nil {
			recordConversionFailure(sourceVersionAPI, targetVersionAPI, err, info, a, b)
		} else {
			recordConversionSuccess(sourceVersionAPI, targetVersionAPI, info)
		}

		return nil
	}
}

// recordConversionFailure records metrics and logs for failed conversions
func recordConversionFailure(sourceVersionAPI, targetVersionAPI string, err error, info dashboardInfo, a, b interface{}) {
	errorType := classifyConversionError(err)

	migration.MDashboardConversionFailureTotal.WithLabelValues(
		sourceVersionAPI,
		targetVersionAPI,
		info.sourceSchemaStr,
		info.targetSchemaStr,
		errorType,
	).Inc()

	logFields := buildErrorLogFields(sourceVersionAPI, targetVersionAPI, errorType, err, info, a, b)
	if errorType == "schema_minimum_version_error" {
		getLogger().Warn("Dashboard conversion failed", logFields...)
	} else {
		getLogger().Error("Dashboard conversion failed", logFields...)
	}
}

// recordConversionSuccess records metrics and logs for successful conversions
func recordConversionSuccess(sourceVersionAPI, targetVersionAPI string, info dashboardInfo) {
	migration.MDashboardConversionSuccessTotal.WithLabelValues(
		sourceVersionAPI,
		targetVersionAPI,
		info.sourceSchemaStr,
		info.targetSchemaStr,
	).Inc()

	successLogFields := buildSuccessLogFields(sourceVersionAPI, targetVersionAPI, info)
	getLogger().Debug("Dashboard conversion succeeded", successLogFields...)
}

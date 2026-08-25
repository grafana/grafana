package conversion

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/conversion"

	"github.com/grafana/grafana-app-sdk/logging"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
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

	// Map API versions to function name format.
	// v1 and v1beta1 both map to "V1" since they share the same Go type (v1beta1 is a thin wrapper).
	switch apiVersion {
	case "v0alpha1":
		return "V0"
	case "v1", "v1beta1":
		return "V1"
	case "v2alpha1":
		return "V2alpha1"
	case "v2beta1":
		return "V2beta1"
	case "v2":
		return "V2"
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
	// sourceSizeBytes is the JSON-encoded size of the source dashboard spec being converted.
	// It is -1 when the size could not be determined (e.g. marshal failure).
	sourceSizeBytes int
}

// byteCountWriter counts the bytes written to it and discards them, so we can
// measure a JSON encoding's size without retaining a full-size copy of it.
type byteCountWriter struct{ n int }

func (w *byteCountWriter) Write(p []byte) (int, error) { w.n += len(p); return len(p), nil }

// specSizeBytes returns the JSON-encoded size of a dashboard spec in bytes.
// It returns -1 if the spec cannot be marshalled so callers can distinguish
// "unknown" from a genuinely empty (zero-byte) spec.
//
// It streams into a counting writer rather than using json.Marshal: this runs
// once per object on every LIST response over specs up to ~20MB, and Marshal
// would allocate a full-size copy of the encoding just to read its length.
func specSizeBytes(spec interface{}) int {
	var w byteCountWriter
	if err := json.NewEncoder(&w).Encode(spec); err != nil {
		getLogger().Debug("failed to measure dashboard spec size", "error", err)
		return -1
	}
	return w.n - 1 // Encode appends a trailing newline
}

// extractDashboardInfo extracts UID, schema versions and source size from source and target dashboards
func extractDashboardInfo(a, b interface{}) dashboardInfo {
	info := dashboardInfo{sourceSizeBytes: -1}

	// get uid, schema version and encoded size from source
	switch source := a.(type) {
	case *dashv0.Dashboard:
		info.uid = source.Name
		info.sourceSizeBytes = specSizeBytes(source.Spec)
		if source.Spec.Object != nil {
			info.sourceSchema = schemaversion.GetSchemaVersion(source.Spec.Object)
		}
	case *dashv1.Dashboard:
		info.uid = source.Name
		info.sourceSizeBytes = specSizeBytes(source.Spec)
		if source.Spec.Object != nil {
			info.sourceSchema = schemaversion.GetSchemaVersion(source.Spec.Object)
		}
	case *dashv2alpha1.Dashboard:
		info.uid = source.Name
		info.sourceSizeBytes = specSizeBytes(source.Spec)
	case *dashv2beta1.Dashboard:
		info.uid = source.Name
		info.sourceSizeBytes = specSizeBytes(source.Spec)
	case *dashv2.Dashboard:
		info.uid = source.Name
		info.sourceSizeBytes = specSizeBytes(source.Spec)
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
func buildErrorLogFields(sourceVersionAPI, targetVersionAPI, errorType string, err error, info dashboardInfo, a, b interface{}, duration time.Duration) []interface{} {
	logFields := []interface{}{
		"sourceVersionAPI", sourceVersionAPI,
		"targetVersionAPI", targetVersionAPI,
		"erroredConversionFunc", getErroredConversionFunc(err),
		"dashboardUID", info.uid,
		"durationMs", duration.Milliseconds(),
	}

	if info.sourceSizeBytes >= 0 {
		logFields = append(logFields, "sourceSizeBytes", info.sourceSizeBytes)
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
func buildSuccessLogFields(sourceVersionAPI, targetVersionAPI string, info dashboardInfo, duration time.Duration) []interface{} {
	logFields := []interface{}{
		"sourceVersionAPI", sourceVersionAPI,
		"targetVersionAPI", targetVersionAPI,
		"dashboardUID", info.uid,
		"durationMs", duration.Milliseconds(),
	}

	if info.sourceSizeBytes >= 0 {
		logFields = append(logFields, "sourceSizeBytes", info.sourceSizeBytes)
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

		// Time the whole conversion path, matching the span above: this includes
		// extractDashboardInfo (which marshals the source to measure its size) and the
		// data-loss check, so the metric reflects the full wall-clock cost of the path.
		start := time.Now()

		info := extractDashboardInfo(a, b)

		span.SetAttributes(attribute.String("dashboard.uid", info.uid))
		if schemaVer, ok := info.sourceSchema.(float64); ok {
			span.SetAttributes(attribute.Int("source.schema_version", int(schemaVer)))
		}
		if info.sourceSizeBytes >= 0 {
			span.SetAttributes(attribute.Int("source.size_bytes", info.sourceSizeBytes))
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

		duration := time.Since(start)

		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "conversion successful")
		}
		span.SetAttributes(attribute.Float64("conversion.duration_seconds", duration.Seconds()))

		if err != nil {
			recordConversionFailure(sourceVersionAPI, targetVersionAPI, err, info, a, b, duration)
		} else {
			recordConversionSuccess(sourceVersionAPI, targetVersionAPI, info, duration)
		}

		return nil
	}
}

// observeConversionObjectSize records the source object size, labelled by outcome, when known.
func observeConversionObjectSize(sourceVersionAPI, targetVersionAPI, outcome string, info dashboardInfo) {
	if info.sourceSizeBytes < 0 {
		return
	}
	migration.MDashboardConversionObjectSizeBytes.WithLabelValues(
		sourceVersionAPI,
		targetVersionAPI,
		outcome,
	).Observe(float64(info.sourceSizeBytes))
}

// recordConversionFailure records metrics and logs for failed conversions
func recordConversionFailure(sourceVersionAPI, targetVersionAPI string, err error, info dashboardInfo, a, b interface{}, duration time.Duration) {
	errorType := classifyConversionError(err)

	migration.MDashboardConversionFailureTotal.WithLabelValues(
		sourceVersionAPI,
		targetVersionAPI,
		info.sourceSchemaStr,
		info.targetSchemaStr,
		errorType,
	).Inc()

	migration.MDashboardConversionDuration.WithLabelValues(
		sourceVersionAPI,
		targetVersionAPI,
		"failure",
	).Observe(duration.Seconds())

	observeConversionObjectSize(sourceVersionAPI, targetVersionAPI, "failure", info)

	logFields := buildErrorLogFields(sourceVersionAPI, targetVersionAPI, errorType, err, info, a, b, duration)
	if errorType == "schema_minimum_version_error" {
		getLogger().Warn("Dashboard conversion failed", logFields...)
	} else {
		getLogger().Error("Dashboard conversion failed", logFields...)
	}
}

// recordConversionSuccess records metrics and logs for successful conversions
func recordConversionSuccess(sourceVersionAPI, targetVersionAPI string, info dashboardInfo, duration time.Duration) {
	migration.MDashboardConversionSuccessTotal.WithLabelValues(
		sourceVersionAPI,
		targetVersionAPI,
		info.sourceSchemaStr,
		info.targetSchemaStr,
	).Inc()

	migration.MDashboardConversionDuration.WithLabelValues(
		sourceVersionAPI,
		targetVersionAPI,
		"success",
	).Observe(duration.Seconds())

	observeConversionObjectSize(sourceVersionAPI, targetVersionAPI, "success", info)

	successLogFields := buildSuccessLogFields(sourceVersionAPI, targetVersionAPI, info, duration)
	getLogger().Debug("Dashboard conversion succeeded", successLogFields...)
}

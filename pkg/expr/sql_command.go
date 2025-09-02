package expr

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/expr/sql"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

const SQLLoggerName = "expr.sql"

// SQLCommand is an expression to run SQL over results
type SQLCommand struct {
	query       string
	varsToQuery []string
	refID       string

	format string

	inputLimit  int64
	outputLimit int64
	timeout     time.Duration
	logger      log.Logger
}

// NewSQLCommand creates a new SQLCommand.
func NewSQLCommand(ctx context.Context, logger log.Logger, refID, format, rawSQL string, intputLimit, outputLimit int64, timeout time.Duration) (*SQLCommand, error) {
	sqlLogger := backend.NewLoggerWith("logger", SQLLoggerName).FromContext(ctx)
	if rawSQL == "" {
		return nil, sql.MakeErrEmptyQuery(refID)
	}
	tables, err := sql.TablesList(ctx, rawSQL)
	if err != nil {
		sqlLogger.Warn("invalid sql query", "sql", rawSQL, "error", err)
		return nil, sql.MakeErrInvalidQuery(refID, err)
	}
	if len(tables) == 0 {
		sqlLogger.Warn("no tables found in SQL query", "sql", rawSQL)
	}
	if tables != nil {
		sqlLogger.Debug("REF tables", "tables", tables, "sql", rawSQL)
	}

	return &SQLCommand{
		query:       rawSQL,
		varsToQuery: tables,
		refID:       refID,
		inputLimit:  intputLimit,
		outputLimit: outputLimit,
		timeout:     timeout,
		format:      format,
		logger:      sqlLogger,
	}, nil
}

// UnmarshalSQLCommand creates a SQLCommand from Grafana's frontend query.
func UnmarshalSQLCommand(ctx context.Context, rn *rawNode, cfg *setting.Cfg) (*SQLCommand, error) {
	sqlLogger := backend.NewLoggerWith("logger", SQLLoggerName).FromContext(ctx)
	if rn.TimeRange == nil {
		sqlLogger.Error("time range must be specified for refID", "refID", rn.RefID)
		return nil, fmt.Errorf("time range must be specified for refID %s", rn.RefID)
	}

	expressionRaw, ok := rn.Query["expression"]
	if !ok {
		sqlLogger.Error("no expression in the query", "query", rn.Query)
		return nil, errors.New("no expression in the query")
	}
	expression, ok := expressionRaw.(string)
	if !ok {
		sqlLogger.Error("expected sql expression to be type string", "expression", expressionRaw)
		return nil, fmt.Errorf("expected sql expression to be type string, but got type %T", expressionRaw)
	}

	if cfg.SQLExpressionQueryLengthLimit > 0 && len(expression) > int(cfg.SQLExpressionQueryLengthLimit) {
		return nil, sql.MakeQueryTooLongError(rn.RefID, cfg.SQLExpressionQueryLengthLimit)
	}

	formatRaw := rn.Query["format"]
	format, _ := formatRaw.(string)

	return NewSQLCommand(ctx, sqlLogger, rn.RefID, format, expression, cfg.SQLExpressionCellLimit, cfg.SQLExpressionOutputCellLimit, cfg.SQLExpressionTimeout)
}

// NeedsVars returns the variable names (refIds) that are dependencies
// to execute the command and allows the command to fulfill the Command interface.
func (gr *SQLCommand) NeedsVars() []string {
	return gr.varsToQuery
}

// Execute runs the command and returns the results if successful.
// If there is an error, it will set Results.Error and return (the return from the func should never error).
func (gr *SQLCommand) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, tracer tracing.Tracer, metrics *metrics.ExprMetrics) (mathexp.Results, error) {
	_, span := tracer.Start(ctx, "SSE.ExecuteSQL")
	start := time.Now()
	tc := int64(0)
	rsp := mathexp.Results{}
	errorType := "none"

	defer func() {
		duration := float64(time.Since(start).Milliseconds())
		statusLabel := "ok"
		if rsp.Error != nil {
			e := &sql.ErrorWithCategory{}
			if errors.As(rsp.Error, &e) {
				errorType = e.Category()
			} else {
				errorType = "unknown"
			}
			statusLabel = "error"
			span.AddEvent("exception", trace.WithAttributes(
				semconv.ExceptionType(errorType),
				semconv.ExceptionMessage(rsp.Error.Error()),
			))
			span.SetAttributes(attribute.String("error.category", errorType))
			span.SetStatus(codes.Error, errorType)
			gr.logger.Error("SQL command execution failed", "error", rsp.Error.Error(), "error_type", errorType)
		}
		span.End()

		// --- Exemplar labels from the current span ---
		sc := span.SpanContext()
		var ex prometheus.Labels
		if sc.IsValid() {
			ex = prometheus.Labels{
				"trace_id": sc.TraceID().String(),
				"span_id":  sc.SpanID().String(),
			}
		}

		// --- Counter with exemplar (if supported) ---
		cnt := metrics.SqlCommandCount.WithLabelValues(statusLabel, errorType)
		if ex != nil {
			if ce, ok := cnt.(prometheus.ExemplarAdder); ok {
				ce.AddWithExemplar(1, ex)
			} else {
				cnt.Inc()
			}
		} else {
			cnt.Inc()
		}

		// --- Duration histogram with exemplar (if supported) ---
		obs := metrics.SqlCommandDuration.WithLabelValues(statusLabel)
		if ex != nil {
			if eo, ok := obs.(prometheus.ExemplarObserver); ok {
				eo.ObserveWithExemplar(duration, ex)
			} else {
				obs.Observe(duration)
			}
		} else {
			obs.Observe(duration)
		}

		// --- Cell count histogram with exemplar (if supported) ---
		obsCells := metrics.SqlCommandCellCount.WithLabelValues(statusLabel)
		if ex != nil {
			if eo, ok := obsCells.(prometheus.ExemplarObserver); ok {
				eo.ObserveWithExemplar(float64(tc), ex)
			} else {
				obsCells.Observe(float64(tc))
			}
		} else {
			obsCells.Observe(float64(tc))
		}

	}()

	allFrames := []*data.Frame{}
	for _, ref := range gr.varsToQuery {
		results, ok := vars[ref]
		if !ok {
			gr.logger.Warn("no results found for", "ref", ref)
			continue
		}
		frames := results.Values.AsDataFrames(ref)
		allFrames = append(allFrames, frames...)
	}

	tc = totalCells(allFrames)

	// limit of 0 or less means no limit (following convention)
	if gr.inputLimit > 0 && tc > gr.inputLimit {
		rsp.Error = sql.MakeInputLimitExceededError(gr.refID, gr.inputLimit)
		return rsp, nil
	}

	gr.logger.Debug("Executing query", "query", gr.query, "frames", len(allFrames))

	db := sql.DB{}
	frame, err := db.QueryFrames(ctx, tracer, gr.refID, gr.query, allFrames, sql.WithMaxOutputCells(gr.outputLimit), sql.WithTimeout(gr.timeout))
	if err != nil {
		rsp.Error = err
		return rsp, nil
	}

	gr.logger.Debug("Done Executing query", "query", gr.query, "rows", frame.Rows())

	if frame.Rows() == 0 {
		rsp.Values = mathexp.Values{
			mathexp.NoData{Frame: frame},
		}
		return rsp, nil
	}

	switch gr.format {
	case "alerting":
		numberSet, err := extractNumberSetFromSQLForAlerting(frame)
		if err != nil {
			rsp.Error = err
			return rsp, nil
		}
		vals := make([]mathexp.Value, 0, len(numberSet))
		for i := range numberSet {
			vals = append(vals, numberSet[i])
		}
		rsp.Values = vals

	default:
		rsp.Values = mathexp.Values{
			mathexp.TableData{Frame: frame},
		}
	}
	return rsp, nil
}

func (gr *SQLCommand) Type() string {
	return TypeSQL.String()
}

func totalCells(frames []*data.Frame) (total int64) {
	for _, frame := range frames {
		if frame != nil {
			// Calculate cells as rows × columns
			rows := int64(frame.Rows())
			cols := int64(len(frame.Fields))
			total += rows * cols
		}
	}
	return
}

// extractNumberSetFromSQLForAlerting converts a data frame produced by a SQL expression
// into a slice of mathexp.Number values for use in alerting.
//
// This function enforces strict semantics: each row must have exactly one numeric value
// and a unique label set. If any label set appears more than once, an error is returned.
//
// It is the responsibility of the SQL query to ensure uniqueness — for example, by
// applying GROUP BY or aggregation clauses. This function will not deduplicate rows;
// it will reject the entire input if any duplicates are present.
//
// Returns an error if:
//   - No numeric field is found.
//   - More than one numeric field exists.
//   - Any label set appears more than once.
func extractNumberSetFromSQLForAlerting(frame *data.Frame) ([]mathexp.Number, error) {
	var (
		numericField   *data.Field
		numericFieldIx int
	)

	// Find the only numeric field
	for i, f := range frame.Fields {
		if f.Type().Numeric() {
			if numericField != nil {
				return nil, fmt.Errorf("expected exactly one numeric field, but found multiple")
			}
			numericField = f
			numericFieldIx = i
		}
	}
	if numericField == nil {
		return nil, fmt.Errorf("no numeric field found in frame")
	}

	type row struct {
		value  float64
		labels data.Labels
	}
	rows := make([]row, 0, frame.Rows())
	counts := map[data.Fingerprint]int{}
	labelMap := map[data.Fingerprint]string{}

	for i := 0; i < frame.Rows(); i++ {
		val, err := numericField.FloatAt(i)
		if err != nil {
			return nil, fmt.Errorf("failed to read numeric value at row %d: %w", i, err)
		}

		labels := data.Labels{}
		for j, f := range frame.Fields {
			if j == numericFieldIx || (f.Type() != data.FieldTypeString && f.Type() != data.FieldTypeNullableString) {
				continue
			}

			val := f.At(i)
			switch v := val.(type) {
			case *string:
				if v != nil {
					labels[f.Name] = *v
				}
			case string:
				labels[f.Name] = v
			}
		}

		fp := labels.Fingerprint()
		counts[fp]++
		labelMap[fp] = labels.String()

		rows = append(rows, row{value: val, labels: labels})
	}

	// Check for any duplicates
	duplicates := make([]string, 0)
	for fp, count := range counts {
		if count > 1 {
			duplicates = append(duplicates, labelMap[fp])
		}
	}

	if len(duplicates) > 0 {
		return nil, sql.MakeDuplicateStringColumnError(duplicates)
	}

	// Build final result
	numbers := make([]mathexp.Number, 0, len(rows))
	for _, r := range rows {
		n := mathexp.NewNumber(numericField.Name, r.labels)
		n.Frame.Fields[0].Config = numericField.Config
		n.SetValue(&r.value)
		numbers = append(numbers, n)
	}

	return numbers, nil
}

// handleSqlInput normalizes input DataFrames into a single dataframe with no labels so it can represent a table for use with SQL expressions.
//
// It handles three cases:
//  1. If the input declares a supported time series or numeric kind in the wide or multi format (via FrameMeta.Type), it converts to a full-long formatted table using ConvertToFullLong.
//  2. If the input is a single frame (no labels, no declared type), it passes through as-is.
//  3. If the input has multiple frames or label metadata but lacks a supported type, it returns an error.
//
// The returned bool indicates if the input was (attempted to be) converted or passed through as-is.
func handleSqlInput(ctx context.Context, tracer trace.Tracer, refID string, forRefIDs map[string]struct{}, dsType string, dataFrames data.Frames) (mathexp.Results, bool) {
	_, span := tracer.Start(ctx, "SSE.HandleConvertSQLInput")
	start := time.Now()
	var result mathexp.Results
	errorType := "none"
	var metaType data.FrameType

	defer func() {
		duration := float64(time.Since(start).Milliseconds())
		statusLabel := "ok"
		if result.Error != nil {
			statusLabel = "error"
		}
		dataType := categorizeFrameInputType(dataFrames)
		span.SetAttributes(
			attribute.String("status", statusLabel),
			attribute.Float64("duration", duration),
			attribute.String("data.type", dataType),
			attribute.String("datasource.type", dsType),
		)

		if result.Error != nil {
			e := &sql.ErrorWithCategory{}
			if errors.As(result.Error, &e) {
				errorType = e.Category()
			} else {
				errorType = "unknown"
			}
			span.AddEvent("exception", trace.WithAttributes(
				semconv.ExceptionType(errorType),
				semconv.ExceptionMessage(result.Error.Error()),
			))
			span.SetAttributes(attribute.String("error.category", errorType))
			span.SetStatus(codes.Error, errorType)
		}
		span.End()
	}()

	if len(dataFrames) == 0 {
		return mathexp.Results{Values: mathexp.Values{mathexp.NewNoData()}}, false
	}

	first := dataFrames[0]

	// Single Frame no data case
	// Note: In the case of a support Frame Type, we may want to return the matching schema
	// with no rows (e.g. include the `__value__` column). But not sure about this at this time.
	if len(dataFrames) == 1 && len(first.Fields) == 0 {
		result.Values = mathexp.Values{
			mathexp.TableData{Frame: first},
		}

		return result, false
	}

	if first.Meta != nil {
		metaType = first.Meta.Type
	}

	if supportedToLongConversion(metaType) {
		convertedFrames, err := ConvertToFullLong(dataFrames)
		if err != nil {
			result.Error = sql.MakeInputConvertError(err, refID, forRefIDs, dsType)
		}

		if len(convertedFrames) == 0 {
			result.Error = fmt.Errorf("conversion succeeded but returned no frames")
			return result, true
		}

		result.Values = mathexp.Values{
			mathexp.TableData{Frame: convertedFrames[0]},
		}

		return result, true
	}

	// If we don't have a supported type for conversion, see if we can pass through as a table (no labels, and only a single frame)
	var frameTypeIssue string
	if metaType == "" {
		frameTypeIssue = "is missing the data type (frame.meta.type)"
	} else {
		frameTypeIssue = fmt.Sprintf("has an unsupported data type [%s]", metaType)
	}

	// If meta.type is not supported, but there are labels or more than 1 frame error
	if len(dataFrames) > 1 {
		result.Error = sql.MakeInputConvertError(fmt.Errorf("can not convert because the response %s and has more than one dataframe that can not be automatically mapped to a single table", frameTypeIssue), refID, forRefIDs, dsType)
		return result, false
	}
	for _, frame := range dataFrames {
		for _, field := range frame.Fields {
			if len(field.Labels) > 0 {
				result.Error = sql.MakeInputConvertError(fmt.Errorf("can not convert because the response %s and has labels in the response that can not be mapped to a table", frameTypeIssue), refID, forRefIDs, dsType)
				return result, false
			}
		}
	}

	// Can pass through as table without conversion
	result.Values = mathexp.Values{
		mathexp.TableData{Frame: first},
	}
	return result, false
}

func categorizeFrameInputType(dataFrames data.Frames) string {
	switch {
	case len(dataFrames) == 0:
		return "missing"
	case dataFrames[0].Meta == nil:
		return "missing"
	case dataFrames[0].Meta.Type == "":
		return "missing"
	case dataFrames[0].Meta.Type.IsKnownType():
		return string(dataFrames[0].Meta.Type)
	default:
		return "unknown"
	}
}

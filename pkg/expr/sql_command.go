package expr

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/expr/sql"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrMissingSQLQuery = errutil.BadRequest("sql-missing-query").Errorf("missing SQL query")
	ErrInvalidSQLQuery = errutil.BadRequest("sql-invalid-sql").MustTemplate(
		"invalid SQL query: {{ .Private.query }} err: {{ .Error }}",
		errutil.WithPublic(
			"Invalid SQL query: {{ .Public.error }}",
		),
	)
)

// SQLCommand is an expression to run SQL over results
type SQLCommand struct {
	query       string
	varsToQuery []string
	refID       string

	format string

	inputLimit  int64
	outputLimit int64
	timeout     time.Duration
}

// NewSQLCommand creates a new SQLCommand.
func NewSQLCommand(refID, format, rawSQL string, intputLimit, outputLimit int64, timeout time.Duration) (*SQLCommand, error) {
	if rawSQL == "" {
		return nil, ErrMissingSQLQuery
	}
	tables, err := sql.TablesList(rawSQL)
	if err != nil {
		logger.Warn("invalid sql query", "sql", rawSQL, "error", err)
		return nil, ErrInvalidSQLQuery.Build(errutil.TemplateData{
			Error: err,
			Public: map[string]any{
				"error": err.Error(),
			},
			Private: map[string]any{
				"query": rawSQL,
			},
		})
	}
	if len(tables) == 0 {
		logger.Warn("no tables found in SQL query", "sql", rawSQL)
	}
	if tables != nil {
		logger.Debug("REF tables", "tables", tables, "sql", rawSQL)
	}

	return &SQLCommand{
		query:       rawSQL,
		varsToQuery: tables,
		refID:       refID,
		inputLimit:  intputLimit,
		outputLimit: outputLimit,
		timeout:     timeout,
		format:      format,
	}, nil
}

// UnmarshalSQLCommand creates a SQLCommand from Grafana's frontend query.
func UnmarshalSQLCommand(rn *rawNode, cfg setting.ConfigProvider) (*SQLCommand, error) {
	if rn.TimeRange == nil {
		logger.Error("time range must be specified for refID", "refID", rn.RefID)
		return nil, fmt.Errorf("time range must be specified for refID %s", rn.RefID)
	}

	expressionRaw, ok := rn.Query["expression"]
	if !ok {
		logger.Error("no expression in the query", "query", rn.Query)
		return nil, errors.New("no expression in the query")
	}
	expression, ok := expressionRaw.(string)
	if !ok {
		logger.Error("expected sql expression to be type string", "expression", expressionRaw)
		return nil, fmt.Errorf("expected sql expression to be type string, but got type %T", expressionRaw)
	}

	formatRaw := rn.Query["format"]
	format, _ := formatRaw.(string)

	cellLimit := cfg.GetValue("expressions", "sql_expression_cell_limit").(int64)
	outputLimit := cfg.GetValue("expressions", "sql_expression_output_cell_limit").(int64)
	timeout := cfg.GetValue("expressions", "sql_expression_timeout").(time.Duration)

	return NewSQLCommand(rn.RefID, format, expression, cellLimit, outputLimit, timeout)
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

	defer func() {
		span.End()
		duration := float64(time.Since(start).Milliseconds())

		statusLabel := "ok"
		if rsp.Error != nil {
			statusLabel = "error"
		}

		metrics.SqlCommandCount.WithLabelValues(statusLabel).Inc()
		metrics.SqlCommandDuration.WithLabelValues(statusLabel).Observe(duration)
		metrics.SqlCommandCellCount.WithLabelValues(statusLabel).Observe(float64(tc))
	}()

	allFrames := []*data.Frame{}
	for _, ref := range gr.varsToQuery {
		results, ok := vars[ref]
		if !ok {
			logger.Warn("no results found for", "ref", ref)
			continue
		}
		frames := results.Values.AsDataFrames(ref)
		allFrames = append(allFrames, frames...)
	}

	tc = totalCells(allFrames)

	// limit of 0 or less means no limit (following convention)
	if gr.inputLimit > 0 && tc > gr.inputLimit {
		rsp.Error = fmt.Errorf(
			"SQL expression: total cell count across all input tables exceeds limit of %d. Total cells: %d",
			gr.inputLimit,
			tc,
		)
		return rsp, nil
	}

	logger.Debug("Executing query", "query", gr.query, "frames", len(allFrames))

	db := sql.DB{}
	frame, err := db.QueryFrames(ctx, tracer, gr.refID, gr.query, allFrames, sql.WithMaxOutputCells(gr.outputLimit), sql.WithTimeout(gr.timeout))
	if err != nil {
		logger.Error("Failed to query frames", "error", err.Error())
		rsp.Error = err
		return rsp, nil
	}
	logger.Debug("Done Executing query", "query", gr.query, "rows", frame.Rows())

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
		return nil, makeDuplicateStringColumnError(duplicates)
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

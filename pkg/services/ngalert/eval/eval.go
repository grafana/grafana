// Package eval executes the condition for an alert definition, evaluates the condition results, and
// returns the alert instance states.
package eval

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/models"
)

// invalidEvalResultFormatError is an error for invalid format of the alert definition evaluation results.
type invalidEvalResultFormatError struct {
	refID  string
	reason string
	err    error
}

func (e *invalidEvalResultFormatError) Error() string {
	s := fmt.Sprintf("invalid format of evaluation results for the alert definition %s: %s", e.refID, e.reason)
	if e.err != nil {
		s = fmt.Sprintf("%s: %s", s, e.err.Error())
	}
	return s
}

func (e *invalidEvalResultFormatError) Unwrap() error {
	return e.err
}

// Condition contains backend expressions and queries and the RefID
// of the query or expression that will be evaluated.
type Condition struct {
	RefID string `json:"refId"`

	QueriesAndExpressions []AlertQuery `json:"queriesAndExpressions"`
}

// ExecutionResults contains the unevaluated results from executing
// a condition.
type ExecutionResults struct {
	AlertDefinitionID int64

	Error error

	Results data.Frames
}

// Results is a slice of evaluated alert instances states.
type Results []result

// result contains the evaluated state of an alert instance
// identified by its labels.
type result struct {
	Instance data.Labels
	State    state // Enum
}

// state is an enum of the evaluation state for an alert instance.
type state int

const (
	// Normal is the eval state for an alert instance condition
	// that evaluated to false.
	Normal state = iota

	// Alerting is the eval state for an alert instance condition
	// that evaluated to false.
	Alerting
)

func (s state) String() string {
	return [...]string{"Normal", "Alerting"}[s]
}

// IsValid checks the condition's validity.
func (c Condition) IsValid() bool {
	// TODO search for refIDs in QueriesAndExpressions
	return len(c.QueriesAndExpressions) != 0
}

// AlertExecCtx is the context provided for executing an alert condition.
type AlertExecCtx struct {
	AlertDefitionID int64
	SignedInUser    *models.SignedInUser

	Ctx context.Context
}

// Execute runs the Condition's expressions or queries.
func (c *Condition) Execute(ctx AlertExecCtx, fromStr, toStr string) (*ExecutionResults, error) {
	result := ExecutionResults{}
	if !c.IsValid() {
		return nil, fmt.Errorf("invalid conditions")
		// TODO: Things probably
	}

	queryDataReq := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			OrgID: ctx.SignedInUser.OrgId,
		},
		Queries: []backend.DataQuery{},
	}

	for i := range c.QueriesAndExpressions {
		q := c.QueriesAndExpressions[i]
		model, err := q.getModel()
		if err != nil {
			return nil, fmt.Errorf("failed to get query model: %w", err)
		}
		interval, err := q.getIntervalDuration()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve intervalMs from the model: %w", err)
		}

		maxDatapoints, err := q.getMaxDatapoints()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve maxDatapoints from the model: %w", err)
		}

		queryDataReq.Queries = append(queryDataReq.Queries, backend.DataQuery{
			JSON:          model,
			Interval:      interval,
			RefID:         q.RefID,
			MaxDataPoints: maxDatapoints,
			QueryType:     q.QueryType,
			TimeRange:     q.RelativeTimeRange.toTimeRange(time.Now()),
		})
	}

	pbRes, err := expr.TransformData(ctx.Ctx, queryDataReq)
	if err != nil {
		return &result, err
	}

	for refID, res := range pbRes.Responses {
		if refID != c.RefID {
			continue
		}
		result.Results = res.Frames
	}

	if len(result.Results) == 0 {
		err = fmt.Errorf("no GEL results")
		result.Error = err
		return &result, err
	}

	return &result, nil
}

// EvaluateExecutionResult takes the ExecutionResult, and returns a frame where
// each column is a string type that holds a string representing its state.
func EvaluateExecutionResult(results *ExecutionResults) (Results, error) {
	evalResults := make([]result, 0)
	labels := make(map[string]bool)
	for _, f := range results.Results {
		rowLen, err := f.RowLen()
		if err != nil {
			return nil, &invalidEvalResultFormatError{refID: f.RefID, reason: "unable to get frame row length", err: err}
		}
		if rowLen > 1 {
			return nil, &invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("unexpected row length: %d instead of 1", rowLen)}
		}

		if len(f.Fields) > 1 {
			return nil, &invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("unexpected field length: %d instead of 1", len(f.Fields))}
		}

		if f.Fields[0].Type() != data.FieldTypeNullableFloat64 {
			return nil, &invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("invalid field type: %d", f.Fields[0].Type())}
		}

		labelsStr := f.Fields[0].Labels.String()
		_, ok := labels[labelsStr]
		if ok {
			return nil, &invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("frame cannot uniquely be identified by its labels: %s", labelsStr)}
		}
		labels[labelsStr] = true

		state := Normal
		val, err := f.Fields[0].FloatAt(0)
		if err != nil || val != 0 {
			state = Alerting
		}

		evalResults = append(evalResults, result{
			Instance: f.Fields[0].Labels,
			State:    state,
		})
	}
	return evalResults, nil
}

// AsDataFrame forms the EvalResults in Frame suitable for displaying in the table panel of the front end.
// This may be temporary, as there might be a fair amount we want to display in the frontend, and it might not make sense to store that in data.Frame.
// For the first pass, I would expect a Frame with a single row, and a column for each instance with a boolean value.
func (evalResults Results) AsDataFrame() data.Frame {
	fields := make([]*data.Field, 0)
	for _, evalResult := range evalResults {
		fields = append(fields, data.NewField("", evalResult.Instance, []bool{evalResult.State != Normal}))
	}
	f := data.NewFrame("", fields...)
	return *f
}

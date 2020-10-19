package eval

/*
// Package eval executes the condition for an alert definition, evaluates the condition results, and
// returns the alert instance states.
package eval
*/

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MinimalDashboard struct {
	Panels []struct {
		ID         int64              `json:"id"`
		Datasource string             `json:"datasource"`
		Targets    []*simplejson.Json `json:"targets"`
	} `json:"panels"`
}

// Condition contains backend expressions and queries and the RefID
// of the query or expression that will be evaluated.
type Condition struct {
	RefID string `json:"refId"`

	QueriesAndExpressions []tsdb.Query `json:"queriesAndExpressions"`
}

// ExecutionResults contains the unevaluated results from executing
// a condition.
type ExecutionResults struct {
	AlertDefinitionID int64

	Error error

	Results data.Frames
}

// Results is a slice of evaluated alert instances states.
type Results []Result

// Result contains the evaluated state of an alert instance
// identified by its labels.
type Result struct {
	Instance data.Labels
	State    State // Enum
}

// State is an enum of the evaluation state for an alert instance.
type State int

const (
	// Normal is the eval state for an alert instance condition
	// that evaluated to false.
	Normal State = iota

	// Alerting is the eval state for an alert instance condition
	// that evaluated to false.
	Alerting
)

func (s State) String() string {
	return [...]string{"Normal", "Alerting"}[s]
}

// IsValid checks the conditions validity
func (c Condition) IsValid() bool {
	// TODO search for refIDs in QueriesAndExpressions
	return len(c.QueriesAndExpressions) != 0
}

// AlertExecCtx is the context provided for executing an alert condition.§
type AlertExecCtx struct {
	AlertDefitionID int64
	SignedInUser    *models.SignedInUser

	Ctx context.Context
}

// Execute runs the Condition's expressions or queries.
func (c *Condition) Execute(ctx AlertExecCtx, fromStr, toStr string) (*ExecutionResults, error) {
	result := ExecutionResults{}
	if !c.IsValid() {
		return nil, fmt.Errorf("Invalid conditions")
	}

	request := &tsdb.TsdbQuery{
		TimeRange: tsdb.NewTimeRange(fromStr, toStr),
		Debug:     true,
		User:      ctx.SignedInUser,
	}
	for i := range c.QueriesAndExpressions {
		request.Queries = append(request.Queries, &c.QueriesAndExpressions[i])
	}

	resp, err := plugins.Transform.Transform(ctx.Ctx, request)
	if err != nil {
		result.Error = err
		return &result, err
	}

	conditionResult := resp.Results[c.RefID]
	if conditionResult == nil {
		err = fmt.Errorf("No GEL results")
		result.Error = err
		return &result, err
	}

	result.Results, err = conditionResult.Dataframes.Decoded()
	if err != nil {
		result.Error = err
		return &result, err
	}

	return &result, nil
}

// EvaluateExecutionResult takes the ExecutionResult, and returns a frame where
// each column is a string type that holds a string representing its state.
func EvaluateExecutionResult(results *ExecutionResults) (Results, error) {
	evalResults := make([]Result, 0)
	labels := make(map[string]bool)
	for _, f := range results.Results {
		rowLen, err := f.RowLen()
		if err != nil {
			return nil, fmt.Errorf("Unable to get frame row length")
		}
		if rowLen > 1 {
			return nil, fmt.Errorf("Invalid frame %v: row length %v", f.Name, rowLen)
		}

		if len(f.Fields) > 1 {
			return nil, fmt.Errorf("Invalid frame %v: field length %v", f.Name, len(f.Fields))
		}

		if f.Fields[0].Type() != data.FieldTypeNullableFloat64 {
			return nil, fmt.Errorf("Invalid frame %v: field type %v", f.Name, f.Fields[0].Type())
		}

		labelsStr := f.Fields[0].Labels.String()
		_, ok := labels[labelsStr]
		if ok {
			return nil, fmt.Errorf("Invalid frame %v: frames cannot uniquely be identified by its labels: %q", f.Name, labelsStr)
		}
		labels[labelsStr] = true

		state := Normal
		val, err := f.Fields[0].FloatAt(0)
		if err != nil || val != 0 {
			state = Alerting
		}

		evalResults = append(evalResults, Result{
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

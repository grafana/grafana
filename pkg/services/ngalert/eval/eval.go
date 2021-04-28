// Package eval executes the condition for an alert definition, evaluates the condition results, and
// returns the alert instance states.
package eval

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr"
)

const alertingEvaluationTimeout = 30 * time.Second

type Evaluator struct {
	Cfg *setting.Cfg
}

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

// ExecutionResults contains the unevaluated results from executing
// a condition.
type ExecutionResults struct {
	AlertDefinitionID int64

	Error error

	Results data.Frames
}

// Results is a slice of evaluated alert instances states.
type Results []Result

// Result contains the evaluated State of an alert instance
// identified by its labels.
type Result struct {
	Instance           data.Labels
	State              State // Enum
	EvaluatedAt        time.Time
	EvaluationDuration time.Duration
}

// State is an enum of the evaluation State for an alert instance.
type State int

const (
	// Normal is the eval state for an alert instance condition
	// that evaluated to false.
	Normal State = iota

	// Alerting is the eval state for an alert instance condition
	// that evaluated to true (Alerting).
	Alerting

	// Pending is the eval state for an alert instance condition
	// that evaluated to true (Alerting) but has not yet met
	// the For duration defined in AlertRule.
	Pending

	// NoData is the eval state for an alert rule condition
	// that evaluated to NoData.
	NoData

	// Error is the eval state for an alert rule condition
	// that evaluated to Error.
	Error
)

func (s State) String() string {
	return [...]string{"Normal", "Alerting", "Pending", "NoData", "Error"}[s]
}

// AlertExecCtx is the context provided for executing an alert condition.
type AlertExecCtx struct {
	OrgID              int64
	ExpressionsEnabled bool

	Ctx context.Context
}

// GetExprRequest validates the condition and creates a expr.Request from it.
func GetExprRequest(ctx AlertExecCtx, data []models.AlertQuery, now time.Time) (*expr.Request, error) {
	req := &expr.Request{
		OrgId: ctx.OrgID,
	}

	for i := range data {
		q := data[i]
		model, err := q.GetModel()
		if err != nil {
			return nil, fmt.Errorf("failed to get query model: %w", err)
		}
		interval, err := q.GetIntervalDuration()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve intervalMs from the model: %w", err)
		}

		maxDatapoints, err := q.GetMaxDatapoints()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve maxDatapoints from the model: %w", err)
		}

		req.Queries = append(req.Queries, expr.Query{
			TimeRange: expr.TimeRange{
				From: q.RelativeTimeRange.ToTimeRange(now).From,
				To:   q.RelativeTimeRange.ToTimeRange(now).To,
			},
			DatasourceUID: q.DatasourceUID,
			JSON:          model,
			Interval:      interval,
			RefID:         q.RefID,
			MaxDataPoints: maxDatapoints,
			QueryType:     q.QueryType,
		})
	}
	return req, nil
}

func executeCondition(ctx AlertExecCtx, c *models.Condition, now time.Time, dataService *tsdb.Service) (*ExecutionResults, error) {
	result := ExecutionResults{}

	execResp, err := executeQueriesAndExpressions(ctx, c.Data, now, dataService)

	if err != nil {
		return &result, err
	}

	for refID, res := range execResp.Responses {
		if refID != c.Condition {
			continue
		}
		result.Results = res.Frames
	}

	if len(result.Results) == 0 {
		err = fmt.Errorf("no transformation results")
		result.Error = err
		return &result, err
	}

	return &result, nil
}

func executeQueriesAndExpressions(ctx AlertExecCtx, data []models.AlertQuery, now time.Time, dataService *tsdb.Service) (*backend.QueryDataResponse, error) {
	queryDataReq, err := GetExprRequest(ctx, data, now)
	if err != nil {
		return nil, err
	}

	exprService := expr.Service{
		Cfg:         &setting.Cfg{ExpressionsEnabled: ctx.ExpressionsEnabled},
		DataService: dataService,
	}
	return exprService.TransformData(ctx.Ctx, queryDataReq)
}

// evaluateExecutionResult takes the ExecutionResult, and returns a frame where
// each column is a string type that holds a string representing its State.
func evaluateExecutionResult(results *ExecutionResults, ts time.Time) (Results, error) {
	evalResults := make([]Result, 0)
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

		val, ok := f.Fields[0].At(0).(*float64)
		if !ok {
			return nil, &invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("expected nullable float64 but got type %T", f.Fields[0].Type())}
		}

		r := Result{
			Instance:           f.Fields[0].Labels,
			EvaluatedAt:        ts,
			EvaluationDuration: time.Since(ts),
		}

		switch {
		case err != nil:
			r.State = Error
		case val == nil:
			r.State = NoData
		case *val == 0:
			r.State = Normal
		default:
			r.State = Alerting
		}

		evalResults = append(evalResults, r)
	}
	return evalResults, nil
}

// AsDataFrame forms the EvalResults in Frame suitable for displaying in the table panel of the front end.
// It displays one row per alert instance, with a column for each label and one for the alerting state.
func (evalResults Results) AsDataFrame() data.Frame {
	fieldLen := len(evalResults)

	uniqueLabelKeys := make(map[string]struct{})

	for _, evalResult := range evalResults {
		for k := range evalResult.Instance {
			uniqueLabelKeys[k] = struct{}{}
		}
	}

	labelColumns := make([]string, 0, len(uniqueLabelKeys))
	for k := range uniqueLabelKeys {
		labelColumns = append(labelColumns, k)
	}

	labelColumns = sort.StringSlice(labelColumns)

	frame := data.NewFrame("evaluation results")
	for _, lKey := range labelColumns {
		frame.Fields = append(frame.Fields, data.NewField(lKey, nil, make([]string, fieldLen)))
	}
	frame.Fields = append(frame.Fields, data.NewField("State", nil, make([]string, fieldLen)))

	for evalIdx, evalResult := range evalResults {
		for lIdx, v := range labelColumns {
			frame.Set(lIdx, evalIdx, evalResult.Instance[v])
		}
		frame.Set(len(labelColumns), evalIdx, evalResult.State.String())
	}
	return *frame
}

// ConditionEval executes conditions and evaluates the result.
func (e *Evaluator) ConditionEval(condition *models.Condition, now time.Time, dataService *tsdb.Service) (Results, error) {
	alertCtx, cancelFn := context.WithTimeout(context.Background(), alertingEvaluationTimeout)
	defer cancelFn()

	alertExecCtx := AlertExecCtx{OrgID: condition.OrgID, Ctx: alertCtx, ExpressionsEnabled: e.Cfg.ExpressionsEnabled}

	execResult, err := executeCondition(alertExecCtx, condition, now, dataService)
	if err != nil {
		return nil, fmt.Errorf("failed to execute conditions: %w", err)
	}

	evalResults, err := evaluateExecutionResult(execResult, now)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate results: %w", err)
	}
	return evalResults, nil
}

// QueriesAndExpressionsEval executes queries and expressions and returns the result.
func (e *Evaluator) QueriesAndExpressionsEval(orgID int64, data []models.AlertQuery, now time.Time, dataService *tsdb.Service) (*backend.QueryDataResponse, error) {
	alertCtx, cancelFn := context.WithTimeout(context.Background(), alertingEvaluationTimeout)
	defer cancelFn()

	alertExecCtx := AlertExecCtx{OrgID: orgID, Ctx: alertCtx, ExpressionsEnabled: e.Cfg.ExpressionsEnabled}

	execResult, err := executeQueriesAndExpressions(alertExecCtx, data, now, dataService)
	if err != nil {
		return nil, fmt.Errorf("failed to execute conditions: %w", err)
	}

	return execResult, nil
}

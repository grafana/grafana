// Package eval executes the condition for an alert definition, evaluates the condition results, and
// returns the alert instance states.
package eval

import (
	"context"
	"errors"
	"fmt"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var logger = log.New("ngalert.eval")

type EvaluatorFactory interface {
	// Validate validates that the condition is correct. Returns nil if the condition is correct. Otherwise, error that describes the failure
	Validate(ctx EvaluationContext, condition models.Condition) error
	// BuildRuleEvaluator build an evaluator pipeline ready to evaluate a rule's query
	Create(ctx EvaluationContext, condition models.Condition) (ConditionEvaluator, error)
}

//go:generate mockery --name ConditionEvaluator --structname ConditionEvaluatorMock --with-expecter --output eval_mocks --outpkg eval_mocks
type ConditionEvaluator interface {
	// EvaluateRaw evaluates the condition and returns raw backend response backend.QueryDataResponse
	EvaluateRaw(ctx context.Context, now time.Time) (resp *backend.QueryDataResponse, err error)
	// Evaluate evaluates the condition and converts the response to Results
	Evaluate(ctx context.Context, now time.Time) EvaluationResult
}

type conditionEvaluator struct {
	pipeline          expr.DataPipeline
	expressionService *expr.Service
	condition         models.Condition
	evalTimeout       time.Duration
}

func (r *conditionEvaluator) EvaluateRaw(ctx context.Context, now time.Time) (resp *backend.QueryDataResponse, err error) {
	defer func() {
		if e := recover(); e != nil {
			logger.FromContext(ctx).Error("alert rule panic", "error", e, "stack", string(debug.Stack()))
			panicErr := fmt.Errorf("alert rule panic; please check the logs for the full stack")
			if err != nil {
				err = fmt.Errorf("queries and expressions execution failed: %w; %v", err, panicErr.Error())
			} else {
				err = panicErr
			}
		}
	}()

	execCtx := ctx
	if r.evalTimeout <= 0 {
		timeoutCtx, cancel := context.WithTimeout(ctx, r.evalTimeout)
		defer cancel()
		execCtx = timeoutCtx
	}
	return r.expressionService.ExecutePipeline(execCtx, now, r.pipeline)
}

// Evaluate evaluates the condition and converts the response to Results
func (r *conditionEvaluator) Evaluate(ctx context.Context, now time.Time) EvaluationResult {
	response, err := r.EvaluateRaw(ctx, now)
	if err != nil {
		return EvaluationResult{
			Error: err,
		}
	}
	execResults := queryDataResponseToExecutionResults(r.condition, response)
	return evaluateExecutionResult(execResults, now)
}

type evaluatorImpl struct {
	evaluationTimeout time.Duration
	dataSourceCache   datasources.CacheService
	expressionService *expr.Service
}

func NewEvaluatorFactory(
	cfg setting.UnifiedAlertingSettings,
	datasourceCache datasources.CacheService,
	expressionService *expr.Service) EvaluatorFactory {
	return &evaluatorImpl{
		evaluationTimeout: cfg.EvaluationTimeout,
		dataSourceCache:   datasourceCache,
		expressionService: expressionService,
	}
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
	// Condition contains the results of the condition
	Condition data.Frames

	// Results contains the results of all queries, reduce and math expressions
	Results map[string]data.Frames

	// NoData contains the DatasourceUID for RefIDs that returned no data.
	NoData map[string]string

	Error error
}

type Results []Result

type EvaluationResult struct {
	Error error
	// NoData contains the DatasourceUID for RefIDs that returned no data.
	NoData *NoDataResult

	EvaluatedAt        time.Time
	EvaluationDuration time.Duration

	Results Results
}

type NoDataResult struct {
	DatasourceToRefID map[string][]string
}

func (n NoDataResult) String() string {
	if n.DatasourceToRefID == nil || len(n.DatasourceToRefID) > 0 {
		return ""
	}
	sb := strings.Builder{}
	for dsUID, refIDs := range n.DatasourceToRefID {
		if sb.Len() > 0 {
			sb.WriteString(",")
		}
		sb.WriteString("[Datasource UID:")
		sb.WriteString(dsUID)
		sb.WriteString(" RefID: [")
		sb.WriteString(strings.Join(refIDs, ","))
		sb.WriteString("]]")
	}
	return sb.String()
}

// Result contains the evaluated State of an alert instance
// identified by its labels.
type Result struct {
	Instance data.Labels
	State    State // Enum

	// Error message for Error state. should be nil if State != Error.
	Error error

	// Results contains the results of all queries, reduce and math expressions
	Results map[string]data.Frames

	// Values contains the RefID and value of reduce and math expressions.
	// It does not contain values for classic conditions as the values
	// in classic conditions do not have a RefID.
	Values map[string]NumberValueCapture

	EvaluatedAt        time.Time
	EvaluationDuration time.Duration
	// EvaluationString is a string representation of evaluation data such
	// as EvalMatches (from "classic condition"), and in the future from operations
	// like SSE "math".
	EvaluationString string
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

func (s State) IsValid() bool {
	return s <= Error
}

func (s State) String() string {
	return [...]string{"Normal", "Alerting", "Pending", "NoData", "Error"}[s]
}

func buildDatasourceHeaders(ctx EvaluationContext) map[string]string {
	headers := map[string]string{
		// Many data sources check this in query method as sometimes alerting needs special considerations.
		// Several existing systems also compare against the value of this header. Altering this constitutes a breaking change.
		//
		// Note: The spelling of this headers is intentionally degenerate from the others for compatibility reasons.
		// When sent over a network, the key of this header is canonicalized to "Fromalert".
		// However, some datasources still compare against the string "FromAlert".
		"FromAlert": "true",

		"X-Cache-Skip": "true",
	}

	key, ok := models.RuleKeyFromContext(ctx.Ctx)
	if ok {
		headers["X-Rule-Uid"] = key.UID
		headers["X-Grafana-Org-Id"] = strconv.FormatInt(key.OrgID, 10)
	}

	return headers
}

// getExprRequest validates the condition, gets the datasource information and creates an expr.Request from it.
func getExprRequest(ctx EvaluationContext, data []models.AlertQuery, dsCacheService datasources.CacheService) (*expr.Request, error) {
	req := &expr.Request{
		OrgId:   ctx.User.OrgID,
		Headers: buildDatasourceHeaders(ctx),
	}

	datasources := make(map[string]*datasources.DataSource, len(data))

	for _, q := range data {
		model, err := q.GetModel()
		if err != nil {
			return nil, fmt.Errorf("failed to get query model from '%s': %w", q.RefID, err)
		}
		interval, err := q.GetIntervalDuration()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve intervalMs from '%s': %w", q.RefID, err)
		}

		maxDatapoints, err := q.GetMaxDatapoints()
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve maxDatapoints from '%s': %w", q.RefID, err)
		}

		ds, ok := datasources[q.DatasourceUID]
		if !ok {
			if expr.IsDataSource(q.DatasourceUID) {
				ds = expr.DataSourceModel()
			} else {
				ds, err = dsCacheService.GetDatasourceByUID(ctx.Ctx, q.DatasourceUID, ctx.User, true)
				if err != nil {
					return nil, fmt.Errorf("failed to build query '%s': %w", q.RefID, err)
				}
			}
			datasources[q.DatasourceUID] = ds
		}

		req.Queries = append(req.Queries, expr.Query{
			TimeRange:     q.RelativeTimeRange.ToTimeRange(),
			DataSource:    ds,
			JSON:          model,
			Interval:      interval,
			RefID:         q.RefID,
			MaxDataPoints: maxDatapoints,
			QueryType:     q.QueryType,
		})
	}
	return req, nil
}

type NumberValueCapture struct {
	Var    string // RefID
	Labels data.Labels
	Value  *float64
}

func queryDataResponseToExecutionResults(c models.Condition, execResp *backend.QueryDataResponse) ExecutionResults {
	// eval captures for the '__value_string__' annotation and the Value property of the API response.
	captures := make([]NumberValueCapture, 0, len(execResp.Responses))
	captureVal := func(refID string, labels data.Labels, value *float64) {
		captures = append(captures, NumberValueCapture{
			Var:    refID,
			Value:  value,
			Labels: labels.Copy(),
		})
	}

	// datasourceUIDsForRefIDs is a short-lived lookup table of RefID to DatasourceUID
	// for efficient lookups of the DatasourceUID when a RefID returns no data
	datasourceUIDsForRefIDs := make(map[string]string)
	for _, next := range c.Data {
		datasourceUIDsForRefIDs[next.RefID] = next.DatasourceUID
	}
	// datasourceExprUID is a special DatasourceUID for expressions
	datasourceExprUID := strconv.FormatInt(expr.DatasourceID, 10)

	result := ExecutionResults{Results: make(map[string]data.Frames)}
	for refID, res := range execResp.Responses {
		if len(res.Frames) == 0 {
			// to ensure that NoData is consistent with Results we do not initialize NoData
			// unless there is at least one RefID that returned no data
			if result.NoData == nil {
				result.NoData = make(map[string]string)
			}
			if s, ok := datasourceUIDsForRefIDs[refID]; ok && s != datasourceExprUID {
				result.NoData[refID] = s
			}
		}

		// for each frame within each response, the response can contain several data types including time-series data.
		// For now, we favour simplicity and only care about single scalar values.
		for _, frame := range res.Frames {
			if len(frame.Fields) != 1 || frame.Fields[0].Type() != data.FieldTypeNullableFloat64 {
				continue
			}
			var v *float64
			if frame.Fields[0].Len() == 1 {
				v = frame.At(0, 0).(*float64) // type checked above
			}
			captureVal(frame.RefID, frame.Fields[0].Labels, v)
		}

		if refID == c.Condition {
			result.Condition = res.Frames
		}
		result.Results[refID] = res.Frames
	}

	// add capture values as data frame metadata to each result (frame) that has matching labels.
	for _, frame := range result.Condition {
		// classic conditions already have metadata set and only have one value, there's no need to add anything in this case.
		if frame.Meta != nil && frame.Meta.Custom != nil {
			if _, ok := frame.Meta.Custom.([]classic.EvalMatch); ok {
				continue // do not overwrite EvalMatch from classic condition.
			}
		}

		frame.SetMeta(&data.FrameMeta{}) // overwrite metadata

		if len(frame.Fields) == 1 {
			theseLabels := frame.Fields[0].Labels
			for _, cap := range captures {
				// matching labels are equal labels, or when one set of labels includes the labels of the other.
				if theseLabels.Equals(cap.Labels) || theseLabels.Contains(cap.Labels) || cap.Labels.Contains(theseLabels) {
					if frame.Meta.Custom == nil {
						frame.Meta.Custom = []NumberValueCapture{}
					}
					frame.Meta.Custom = append(frame.Meta.Custom.([]NumberValueCapture), cap)
				}
			}
		}
	}

	return result
}

// datasourceUIDsToRefIDs returns a sorted slice of Ref IDs for each Datasource UID.
//
// If refIDsToDatasourceUIDs is nil then this function also returns nil. Likewise,
// if it is an empty map then it too returns an empty map.
//
// For example, given the following:
//
//	map[string]string{
//		"ref1": "datasource1",
//		"ref2": "datasource1",
//		"ref3": "datasource2",
//	}
//
// we would expect:
//
//	 	map[string][]string{
//				"datasource1": []string{"ref1", "ref2"},
//				"datasource2": []string{"ref3"},
//			}
func datasourceUIDsToRefIDs(refIDsToDatasourceUIDs map[string]string) map[string][]string {
	if refIDsToDatasourceUIDs == nil {
		return nil
	}

	// The ref IDs must be sorted. However, instead of sorting them once
	// for each Datasource UID we can append them all to a slice and then
	// sort them once
	refIDs := make([]string, 0, len(refIDsToDatasourceUIDs))
	for refID := range refIDsToDatasourceUIDs {
		refIDs = append(refIDs, refID)
	}
	sort.Strings(refIDs)

	result := make(map[string][]string)
	for _, refID := range refIDs {
		datasourceUID := refIDsToDatasourceUIDs[refID]
		result[datasourceUID] = append(result[datasourceUID], refID)
	}

	return result
}

// evaluateExecutionResult takes the ExecutionResult which includes data.Frames returned
// from SSE (Server Side Expressions). It will create Results (slice of Result) with a State
// extracted from each Frame.
//
// If the ExecutionResults error property is not nil, a single Error result will be returned.
// If there is no error and no results then a single NoData state Result will be returned.
//
// Each non-empty Frame must be a single Field of type []*float64 and of length 1.
// Also, each Frame must be uniquely identified by its Field.Labels or a single Error result will be returned.
//
// Per Frame, data becomes a State based on the following rules:
//
// If no value is set:
//   - Empty or zero length Frames result in NoData.
//
// If a value is set:
//   - 0 results in Normal.
//   - Nonzero (e.g 1.2, NaN) results in Alerting.
//   - nil results in noData.
//   - unsupported Frame schemas results in Error.
func evaluateExecutionResult(execResults ExecutionResults, ts time.Time) EvaluationResult {
	evalResults := make([]Result, 0)

	result := EvaluationResult{
		EvaluatedAt:        ts,
		EvaluationDuration: time.Since(ts),
	}

	if execResults.Error != nil {
		result.Error = execResults.Error
		return result
	}

	if len(execResults.NoData) > 0 {
		result.NoData = &NoDataResult{DatasourceToRefID: datasourceUIDsToRefIDs(execResults.NoData)}
		return result
	}

	if len(execResults.Condition) == 0 {
		result.NoData = &NoDataResult{}
		return result
	}

	var noDataCount, errorsCount = 0, 0
	for _, f := range execResults.Condition {
		r, err := frameToResult(f)
		r.EvaluatedAt = result.EvaluatedAt
		r.EvaluationDuration = result.EvaluationDuration
		if err != nil {
			errorsCount++
			evalResults = append(evalResults, Result{State: Error, Error: err})
			continue
		}
		if r.State == NoData && r.Instance == nil {
			noDataCount++
		}
		evalResults = append(evalResults, r)
	}

	// if all frames are no data without labels declare global no-data status (otherwise it may be error because of duplicated labels)
	if len(evalResults) == noDataCount {
		result.NoData = &NoDataResult{}
		return result
	}
	// if conversion of all frames resulted in error, pick the first and report as error
	if len(evalResults) == errorsCount {
		result.Error = evalResults[0].Error
		return result
	}

	seenLabels := make(map[string]bool)
	for _, res := range evalResults {
		labelsStr := res.Instance.String()
		_, ok := seenLabels[labelsStr]
		if ok {
			return EvaluationResult{
				Error: &invalidEvalResultFormatError{reason: fmt.Sprintf("frame cannot uniquely be identified by its labels: has duplicate results with labels {%s}", labelsStr)},
			}
		}
		seenLabels[labelsStr] = true
	}

	result.Results = evalResults
	return result
}

func frameToResult(f *data.Frame) (Result, error) {
	rowLen, err := f.RowLen()
	if err != nil {
		return Result{}, &invalidEvalResultFormatError{refID: f.RefID, reason: "unable to get frame row length", err: err}
	}

	if len(f.TypeIndices(data.FieldTypeTime, data.FieldTypeNullableTime)) > 0 {
		return Result{}, &invalidEvalResultFormatError{refID: f.RefID, reason: "looks like time series data, only reduced data can be alerted on."}
	}

	if rowLen == 0 {
		var labels data.Labels
		if len(f.Fields) == 1 {
			labels = f.Fields[0].Labels
		}
		return Result{
			State:    NoData,
			Instance: labels,
		}, nil
	}

	if rowLen > 1 {
		return Result{}, &invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("unexpected row length: %d instead of 0 or 1", rowLen)}
	}

	if len(f.Fields) > 1 {
		return Result{}, &invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("unexpected field length: %d instead of 1", len(f.Fields))}
	}

	if f.Fields[0].Type() != data.FieldTypeNullableFloat64 {
		return Result{}, &invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("invalid field type: %s", f.Fields[0].Type())}
	}

	val := f.Fields[0].At(0).(*float64) // type checked by data.FieldTypeNullableFloat64 above

	r := Result{
		Instance:         f.Fields[0].Labels,
		Values:           extractValues(f),
		EvaluationString: extractEvalString(f),
	}

	switch {
	case val == nil:
		r.State = NoData
	case *val == 0:
		r.State = Normal
	default:
		r.State = Alerting
	}
	return r, nil
}

func (r EvaluationResult) AsDataFrame() data.Frame {
	if r.Error != nil {
		return *data.NewFrame("evaluation results", data.NewField("State", nil, []string{Error.String()}), data.NewField("Info", nil, []string{r.Error.Error()}))
	}
	if r.NoData != nil {
		return r.NoData.AsDataFrame()
	}
	return r.Results.AsDataFrame()
}

func (n NoDataResult) AsDataFrame() data.Frame {
	if n.DatasourceToRefID != nil && len(n.DatasourceToRefID) > 0 {
		length := len(n.DatasourceToRefID)
		state := data.NewField("State", nil, make([]string, length))
		ds := data.NewField("datasource_uid", nil, make([]string, length))
		refid := data.NewField("ref_id", nil, make([]string, length))
		frame := data.NewFrame("evaluation results", state, ds, refid)
		idx := 0
		for datasourceUID, refIDs := range n.DatasourceToRefID {
			state.Set(idx, NoData.String())
			ds.Set(idx, datasourceUID)
			refid.Set(idx, strings.Join(refIDs, ","))
			idx++
		}
		return *frame
	}
	return *data.NewFrame("evaluation results", data.NewField("State", nil, []string{NoData.String()}))
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

	frame := data.NewFrame("evaluation results")
	for _, lKey := range labelColumns {
		frame.Fields = append(frame.Fields, data.NewField(lKey, nil, make([]string, fieldLen)))
	}
	frame.Fields = append(frame.Fields, data.NewField("State", nil, make([]string, fieldLen)))
	frame.Fields = append(frame.Fields, data.NewField("Info", nil, make([]string, fieldLen)))

	for evalIdx, evalResult := range evalResults {
		for lIdx, v := range labelColumns {
			frame.Set(lIdx, evalIdx, evalResult.Instance[v])
		}

		frame.Set(len(labelColumns), evalIdx, evalResult.State.String())

		switch {
		case evalResult.Error != nil:
			frame.Set(len(labelColumns)+1, evalIdx, evalResult.Error.Error())
		case evalResult.EvaluationString != "":
			frame.Set(len(labelColumns)+1, evalIdx, evalResult.EvaluationString)
		}
	}
	return *frame
}

func (e *evaluatorImpl) Validate(ctx EvaluationContext, condition models.Condition) error {
	_, err := e.Create(ctx, condition)
	return err
}

func (e *evaluatorImpl) Create(ctx EvaluationContext, condition models.Condition) (ConditionEvaluator, error) {
	if len(condition.Data) == 0 {
		return nil, errors.New("expression list is empty. must be at least 1 expression")
	}
	if len(condition.Condition) == 0 {
		return nil, errors.New("condition must not be empty")
	}
	req, err := getExprRequest(ctx, condition.Data, e.dataSourceCache)
	if err != nil {
		return nil, err
	}
	pipeline, err := e.expressionService.BuildPipeline(req)
	if err != nil {
		return nil, err
	}
	conditions := make([]string, 0, len(pipeline))
	for _, node := range pipeline {
		if node.RefID() == condition.Condition {
			return &conditionEvaluator{
				pipeline:          pipeline,
				expressionService: e.expressionService,
				condition:         condition,
				evalTimeout:       e.evaluationTimeout,
			}, nil
		}
		conditions = append(conditions, node.RefID())
	}
	return nil, fmt.Errorf("condition %s does not exist, must be one of %v", condition.Condition, conditions)
}

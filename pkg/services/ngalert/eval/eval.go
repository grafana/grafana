// Package eval executes the condition for an alert definition, evaluates the condition results, and
// returns the alert instance states.
package eval

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("ngalert.eval")

type EvaluatorFactory interface {
	// Create builds an evaluator pipeline ready to evaluate a rule's query
	Create(ctx EvaluationContext, condition models.Condition) (ConditionEvaluator, error)
}

//go:generate mockery --name ConditionEvaluator --structname ConditionEvaluatorMock --with-expecter --output eval_mocks --outpkg eval_mocks
type ConditionEvaluator interface {
	// EvaluateRaw evaluates the condition and returns raw backend response backend.QueryDataResponse
	EvaluateRaw(ctx context.Context, now time.Time) (resp *backend.QueryDataResponse, err error)
	// Evaluate evaluates the condition and converts the response to Results
	Evaluate(ctx context.Context, now time.Time) (Results, error)
}

type expressionExecutor interface {
	ExecutePipeline(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error)
}

type expressionBuilder interface {
	expressionExecutor
	BuildPipeline(req *expr.Request) (expr.DataPipeline, error)
}

type conditionEvaluator struct {
	pipeline          expr.DataPipeline
	expressionService expressionExecutor
	condition         models.Condition
	evalTimeout       time.Duration
	evalResultLimit   int
}

func (r *conditionEvaluator) EvaluateRaw(ctx context.Context, now time.Time) (resp *backend.QueryDataResponse, err error) {
	defer func() {
		if e := recover(); e != nil {
			logger.FromContext(ctx).Error("Alert rule panic", "error", e, "stack", string(debug.Stack()))
			panicErr := fmt.Errorf("alert rule panic; please check the logs for the full stack")
			if err != nil {
				err = fmt.Errorf("queries and expressions execution failed: %w; %v", err, panicErr.Error())
			} else {
				err = panicErr
			}
		}
	}()

	execCtx := ctx
	if r.evalTimeout >= 0 {
		timeoutCtx, cancel := context.WithTimeout(ctx, r.evalTimeout)
		defer cancel()
		execCtx = timeoutCtx
	}
	logger.FromContext(ctx).Debug("Executing pipeline", "commands", strings.Join(r.pipeline.GetCommandTypes(), ","), "datasources", strings.Join(r.pipeline.GetDatasourceTypes(), ","))
	result, err := r.expressionService.ExecutePipeline(execCtx, now, r.pipeline)

	// Check if the result of the condition evaluation is too large
	if err == nil && result != nil && r.evalResultLimit > 0 {
		conditionResultLength := 0
		if conditionResponse, ok := result.Responses[r.condition.Condition]; ok {
			conditionResultLength = len(conditionResponse.Frames)
		}
		if conditionResultLength > r.evalResultLimit {
			logger.FromContext(ctx).Error("Query evaluation returned too many results", "limit", r.evalResultLimit, "actual", conditionResultLength)
			return nil, fmt.Errorf("query evaluation returned too many results: %d (limit: %d)", conditionResultLength, r.evalResultLimit)
		}
	}

	return result, err
}

// Evaluate evaluates the condition and converts the response to Results
func (r *conditionEvaluator) Evaluate(ctx context.Context, now time.Time) (Results, error) {
	response, err := r.EvaluateRaw(ctx, now)
	if err != nil {
		return nil, err
	}
	return EvaluateAlert(response, r.condition, now), nil
}

type evaluatorImpl struct {
	evaluationTimeout     time.Duration
	evaluationResultLimit int
	dataSourceCache       datasources.CacheService
	expressionService     expressionBuilder
}

func NewEvaluatorFactory(
	cfg setting.UnifiedAlertingSettings,
	datasourceCache datasources.CacheService,
	expressionService *expr.Service,
) EvaluatorFactory {
	return &evaluatorImpl{
		evaluationTimeout:     cfg.EvaluationTimeout,
		evaluationResultLimit: cfg.EvaluationResultLimit,
		dataSourceCache:       datasourceCache,
		expressionService:     expressionService,
	}
}

// EvaluateAlert takes the results of an executed query and evaluates it as an alert rule, returning alert states that the query produces.
func EvaluateAlert(queryResponse *backend.QueryDataResponse, condition models.Condition, now time.Time) Results {
	execResults := queryDataResponseToExecutionResults(condition, queryResponse)
	return evaluateExecutionResult(execResults, now)
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

// Results is a slice of evaluated alert instances states.
type Results []Result

// HasErrors returns true when Results contains at least one element with error
func (evalResults Results) HasErrors() bool {
	for _, r := range evalResults {
		if r.State == Error {
			return true
		}
	}
	return false
}

// HasNonRetryableErrors returns true if we have at least 1 result with:
// 1. A `State` of `Error`
// 2. The `Error` attribute is not nil
// 3. The `Error` matches IsNonRetryableError
// Our thinking with this approach, is that we don't want to retry errors that have relation with invalid alert definition format.
func (evalResults Results) HasNonRetryableErrors() bool {
	for _, r := range evalResults {
		if r.State == Error && r.Error != nil {
			if IsNonRetryableError(r.Error) {
				return true
			}
		}
	}
	return false
}

// IsNonRetryableError indicates whether an error is considered persistent and not worth performing evaluation retries.
// Currently it is true if err is `&invalidEvalResultFormatError` or `ErrSeriesMustBeWide`
func IsNonRetryableError(err error) bool {
	var nonRetryableError *invalidEvalResultFormatError
	if errors.As(err, &nonRetryableError) {
		return true
	}
	if errors.Is(err, expr.ErrSeriesMustBeWide) {
		return true
	}
	return false
}

// HasErrors returns true when Results contains at least one element and all elements are errors
func (evalResults Results) IsError() bool {
	for _, r := range evalResults {
		if r.State != Error {
			return false
		}
	}
	return len(evalResults) > 0
}

// IsNoData returns true when all items are NoData or Results is empty
func (evalResults Results) IsNoData() bool {
	for _, result := range evalResults {
		if result.State != NoData {
			return false
		}
	}
	return true
}

// Error returns the aggregated `error` of all results of which state is `Error`.
func (evalResults Results) Error() error {
	var errs []error
	for _, result := range evalResults {
		if result.State == Error && result.Error != nil {
			errs = append(errs, result.Error)
		}
	}

	return errors.Join(errs...)
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

	// Values contains the labels and values for all Threshold, Reduce and Math expressions,
	// and all conditions of a Classic Condition that are firing. Threshold, Reduce and Math
	// expressions are indexed by their Ref ID, while conditions in a Classic Condition are
	// indexed by their Ref ID and the index of the condition. For example, B0, B1, etc.
	Values map[string]NumberValueCapture

	EvaluatedAt        time.Time
	EvaluationDuration time.Duration
	// EvaluationString is a string representation of evaluation data such
	// as EvalMatches (from "classic condition"), and in the future from operations
	// like SSE "math".
	EvaluationString string
}

func NewResultFromError(err error, evaluatedAt time.Time, duration time.Duration) Result {
	return Result{
		State:              Error,
		Error:              err,
		EvaluatedAt:        evaluatedAt,
		EvaluationDuration: duration,
	}
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

func ParseStateString(repr string) (State, error) {
	switch strings.ToLower(repr) {
	case "normal":
		return Normal, nil
	case "alerting":
		return Alerting, nil
	case "pending":
		return Pending, nil
	case "nodata":
		return NoData, nil
	case "error":
		return Error, nil
	default:
		return -1, fmt.Errorf("invalid state: %s", repr)
	}
}

func buildDatasourceHeaders(ctx context.Context, metadata map[string]string) map[string]string {
	headers := make(map[string]string, len(metadata)+3)

	if len(metadata) > 0 {
		for key, value := range metadata {
			headers[fmt.Sprintf("http_X-Rule-%s", key)] = url.QueryEscape(value)
		}
	}

	// Many data sources check this in query method as sometimes alerting needs special considerations.
	// Several existing systems also compare against the value of this header. Altering this constitutes a breaking change.
	//
	// Note: The spelling of this headers is intentionally degenerate from the others for compatibility reasons.
	// When sent over a network, the key of this header is canonicalized to "Fromalert".
	// However, some datasources still compare against the string "FromAlert".
	headers[models.FromAlertHeaderName] = "true"
	headers[models.CacheSkipHeaderName] = "true"

	key, ok := models.RuleKeyFromContext(ctx)
	if ok {
		headers["X-Grafana-Org-Id"] = strconv.FormatInt(key.OrgID, 10)
	}

	return headers
}

// getExprRequest validates the condition, gets the datasource information and creates an expr.Request from it.
func getExprRequest(ctx EvaluationContext, condition models.Condition, dsCacheService datasources.CacheService, reader AlertingResultsReader) (*expr.Request, error) {
	req := &expr.Request{
		OrgId:   ctx.User.GetOrgID(),
		Headers: buildDatasourceHeaders(ctx.Ctx, condition.Metadata),
		User:    ctx.User,
	}
	datasources := make(map[string]*datasources.DataSource, len(condition.Data))

	for _, q := range condition.Data {
		var err error
		ds, ok := datasources[q.DatasourceUID]
		if !ok {
			switch nodeType := expr.NodeTypeFromDatasourceUID(q.DatasourceUID); nodeType {
			case expr.TypeDatasourceNode:
				ds, err = dsCacheService.GetDatasourceByUID(ctx.Ctx, q.DatasourceUID, ctx.User, false /*skipCache*/)
			default:
				ds, err = expr.DataSourceModelFromNodeType(nodeType)
			}
			if err != nil {
				return nil, fmt.Errorf("failed to build query '%s': %w", q.RefID, err)
			}
			datasources[q.DatasourceUID] = ds
		}

		// TODO rewrite the code below and remove the mutable component from AlertQuery

		// if the query is command expression and it's a hysteresis, patch it with the current state
		// it's important to do this before GetModel
		if ds.Type == expr.DatasourceType {
			isHysteresis, err := q.IsHysteresisExpression()
			if err != nil {
				return nil, fmt.Errorf("failed to build query '%s': %w", q.RefID, err)
			}
			if isHysteresis {
				// make sure we allow hysteresis expressions to be specified only as the alert condition.
				// This guarantees us that the AlertResultsReader can be correctly applied to the expression tree.
				if q.RefID != condition.Condition {
					return nil, fmt.Errorf("recovery threshold '%s' is only allowed to be the alert condition", q.RefID)
				}
				if reader != nil {
					active := reader.Read()
					logger.FromContext(ctx.Ctx).Debug("Detected hysteresis threshold command. Populating with the results", "items", len(active))
					err = q.PatchHysteresisExpression(active)
					if err != nil {
						return nil, fmt.Errorf("failed to amend hysteresis command '%s': %w", q.RefID, err)
					}
				}
			}
		}

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

	Value *float64
}

func IsNoData(res backend.DataResponse) bool {
	// There are two possible frame formats for No Data:
	//
	// 1. A response with no frames
	// 2. A response with 1 frame but no fields
	//
	// The first format is not documented in the data plane contract but needs to be
	// supported for older datasource plugins. The second format is documented in
	// https://github.com/grafana/grafana-plugin-sdk-go/blob/main/data/contract_docs/contract.md
	// and is what datasource plugins should use going forward.
	if len(res.Frames) <= 1 {
		hasNoFrames := len(res.Frames) == 0
		hasNoFields := len(res.Frames) == 1 && len(res.Frames[0].Fields) == 0
		return hasNoFrames || hasNoFields
	}
	return false
}

func queryDataResponseToExecutionResults(c models.Condition, execResp *backend.QueryDataResponse) ExecutionResults {
	// captures contains the values of all instant queries and expressions for each dimension
	captures := make(map[string]map[data.Fingerprint]NumberValueCapture)
	captureFn := func(refID string, labels data.Labels, value *float64) {
		m := captures[refID]
		if m == nil {
			m = make(map[data.Fingerprint]NumberValueCapture)
		}
		fp := labels.Fingerprint()
		m[fp] = NumberValueCapture{
			Var:    refID,
			Value:  value,
			Labels: labels.Copy(),
		}
		captures[refID] = m
	}

	// datasourceUIDsForRefIDs is a short-lived lookup table of RefID to DatasourceUID
	// for efficient lookups of the DatasourceUID when a RefID returns no data
	datasourceUIDsForRefIDs := make(map[string]string)
	for _, next := range c.Data {
		datasourceUIDsForRefIDs[next.RefID] = next.DatasourceUID
	}

	result := ExecutionResults{Results: make(map[string]data.Frames)}

	result.Error = FindConditionError(execResp, c.Condition)

	for refID, res := range execResp.Responses {
		if IsNoData(res) {
			// To make sure NoData is nil when Results are also nil we wait to initialize
			// NoData until there is at least one query or expression that returned no data
			if result.NoData == nil {
				result.NoData = make(map[string]string)
			}
			if s, ok := datasourceUIDsForRefIDs[refID]; ok && expr.NodeTypeFromDatasourceUID(s) == expr.TypeDatasourceNode { // TODO perhaps extract datasource UID from ML expression too.
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
			captureFn(refID, frame.Fields[0].Labels, v)
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
			fp := theseLabels.Fingerprint()

			for _, fps := range captures {
				// First look for a capture whose labels are an exact match
				if v, ok := fps[fp]; ok {
					if frame.Meta.Custom == nil {
						frame.Meta.Custom = []NumberValueCapture{}
					}
					frame.Meta.Custom = append(frame.Meta.Custom.([]NumberValueCapture), v)
				} else {
					// If no exact match was found, look for captures whose labels are either subsets
					// or supersets
					for _, v := range fps {
						// matching labels are equal labels, or when one set of labels includes the labels of the other.
						if theseLabels.Equals(v.Labels) || theseLabels.Contains(v.Labels) || v.Labels.Contains(theseLabels) {
							if frame.Meta.Custom == nil {
								frame.Meta.Custom = []NumberValueCapture{}
							}
							frame.Meta.Custom = append(frame.Meta.Custom.([]NumberValueCapture), v)
						}
					}
				}
			}
		}
	}

	return result
}

// FindConditionError extracts the error from a query response that caused the given condition to fail.
// If a condition failed because a node it depends on had an error, that error is returned instead.
// It returns nil if there are no errors related to the condition.
func FindConditionError(resp *backend.QueryDataResponse, condition string) error {
	if resp == nil {
		return nil
	}

	errs := make(map[string]error)
	for refID, node := range resp.Responses {
		if node.Error != nil {
			errs[refID] = node.Error
		}
	}

	conditionErr := errs[condition]

	// If the error of the condition is an Error that indicates the condition failed
	// because one of its dependent query or expressions failed, then we follow
	// the dependency chain to an error that is not a dependency error.
	if conditionErr != nil {
		if errors.Is(conditionErr, expr.DependencyError) {
			var utilError errutil.Error
			e := conditionErr
			for {
				errors.As(e, &utilError)
				depRefID := utilError.PublicPayload["depRefId"].(string)
				depError, ok := errs[depRefID]
				if !ok {
					return conditionErr
				}
				if !errors.Is(depError, expr.DependencyError) {
					conditionErr = depError
					return conditionErr
				}
				e = depError
			}
		}
	}

	return conditionErr
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
// An exception to this is data that is returned by the query service, which might have a timestamp and single value.
// Those are handled with the appropriated logic.
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
func evaluateExecutionResult(execResults ExecutionResults, ts time.Time) Results {
	evalResults := make([]Result, 0)

	appendErrRes := func(e error) {
		evalResults = append(evalResults, NewResultFromError(e, ts, time.Since(ts)))
	}

	appendNoData := func(labels data.Labels) {
		evalResults = append(evalResults, Result{
			State:              NoData,
			Instance:           labels,
			EvaluatedAt:        ts,
			EvaluationDuration: time.Since(ts),
		})
	}

	if execResults.Error != nil {
		appendErrRes(execResults.Error)
		return evalResults
	}

	if len(execResults.NoData) > 0 {
		noData := datasourceUIDsToRefIDs(execResults.NoData)
		for datasourceUID, refIDs := range noData {
			appendNoData(data.Labels{
				"datasource_uid": datasourceUID,
				"ref_id":         strings.Join(refIDs, ","),
			})
		}
		return evalResults
	}

	if len(execResults.Condition) == 0 {
		appendNoData(nil)
		return evalResults
	}

	for _, f := range execResults.Condition {
		rowLen, err := f.RowLen()
		if err != nil {
			appendErrRes(&invalidEvalResultFormatError{refID: f.RefID, reason: "unable to get frame row length", err: err})
			continue
		}

		if len(f.TypeIndices(data.FieldTypeTime, data.FieldTypeNullableTime)) > 0 {
			appendErrRes(&invalidEvalResultFormatError{refID: f.RefID, reason: "looks like time series data, only reduced data can be alerted on."})
			continue
		}

		if rowLen == 0 {
			if len(f.Fields) == 0 {
				appendNoData(nil)
				continue
			}
			if len(f.Fields) == 1 {
				appendNoData(f.Fields[0].Labels)
				continue
			}
		}

		if rowLen > 1 {
			appendErrRes(&invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("unexpected row length: %d instead of 0 or 1", rowLen)})
			continue
		}

		if len(f.Fields) > 1 {
			appendErrRes(&invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("unexpected field length: %d instead of 1", len(f.Fields))})
			continue
		}

		if f.Fields[0].Type() != data.FieldTypeNullableFloat64 {
			appendErrRes(&invalidEvalResultFormatError{refID: f.RefID, reason: fmt.Sprintf("invalid field type: %s", f.Fields[0].Type())})
			continue
		}

		val := f.Fields[0].At(0).(*float64) // type checked by data.FieldTypeNullableFloat64 above
		r := buildResult(f, val, ts)

		evalResults = append(evalResults, r)
	}

	seenLabels := make(map[string]bool)
	for _, res := range evalResults {
		labelsStr := res.Instance.String()
		_, ok := seenLabels[labelsStr]
		if ok {
			return Results{
				Result{
					State:              Error,
					Instance:           res.Instance,
					EvaluatedAt:        ts,
					EvaluationDuration: time.Since(ts),
					Error:              &invalidEvalResultFormatError{reason: fmt.Sprintf("frame cannot uniquely be identified by its labels: has duplicate results with labels {%s}", labelsStr)},
				},
			}
		}
		seenLabels[labelsStr] = true
	}

	return evalResults
}

func buildResult(f *data.Frame, val *float64, ts time.Time) Result {
	r := Result{
		Instance:           f.Fields[0].Labels,
		EvaluatedAt:        ts,
		EvaluationDuration: time.Since(ts),
		EvaluationString:   extractEvalString(f),
		Values:             extractValues(f),
	}
	switch {
	case val == nil:
		r.State = NoData
	case *val == 0:
		r.State = Normal
	default:
		r.State = Alerting
	}
	return r
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

func (e *evaluatorImpl) Create(ctx EvaluationContext, condition models.Condition) (ConditionEvaluator, error) {
	if len(condition.Data) == 0 {
		return nil, errors.New("expression list is empty. must be at least 1 expression")
	}
	if len(condition.Condition) == 0 {
		return nil, errors.New("condition must not be empty")
	}
	req, err := getExprRequest(ctx, condition, e.dataSourceCache, ctx.AlertingResultsReader)
	if err != nil {
		return nil, err
	}
	return e.create(condition, req)
}

func (e *evaluatorImpl) create(condition models.Condition, req *expr.Request) (ConditionEvaluator, error) {
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
				evalResultLimit:   e.evaluationResultLimit,
			}, nil
		}
		conditions = append(conditions, node.RefID())
	}
	return nil, models.ErrConditionNotExist(condition.Condition, conditions)
}

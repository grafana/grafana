package state

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/screenshot"
)

type State struct {
	OrgID        int64
	AlertRuleUID string

	// CacheID is a unique, opaque identifier for the state, and is used to find the state
	// in the state cache. It tends to be derived from the state's labels.
	CacheID string

	// State represents the current state.
	State eval.State

	// StateReason is a textual description to explain why the state has its current state.
	StateReason string

	// Results contains the result of the current and previous evaluations.
	Results []Evaluation

	// Error is set if the current evaluation returned an error. If error is non-nil results
	// can still contain the results of previous evaluations.
	Error error

	// Resolved is set to true if this state is the transitional state between Firing and Normal.
	// All subsequent states will be false until the next transition from Firing to Normal.
	Resolved bool

	// Image contains an optional image for the state. It tends to be included in notifications
	// as a visualization to show why the alert fired.
	Image *models.Image

	// Annotations contains the annotations from the alert rule. If an annotation is templated
	// then the template is first evaluated to derive the final annotation.
	Annotations map[string]string

	// Labels contain the labels from the query and any custom labels from the alert rule.
	// If a label is templated then the template is first evaluated to derive the final label.
	Labels data.Labels

	// Values contains the values of any instant vectors, reduce and math expressions, or classic
	// conditions.
	Values map[string]float64

	StartsAt             time.Time
	EndsAt               time.Time
	LastSentAt           time.Time
	LastEvaluationString string
	LastEvaluationTime   time.Time
	EvaluationDuration   time.Duration
}

func (a *State) GetRuleKey() models.AlertRuleKey {
	return models.AlertRuleKey{
		OrgID: a.OrgID,
		UID:   a.AlertRuleUID,
	}
}

func (a *State) GetAlertInstanceKey() (models.AlertInstanceKey, error) {
	instanceLabels := models.InstanceLabels(a.Labels)
	_, labelsHash, err := instanceLabels.StringAndHash()
	if err != nil {
		return models.AlertInstanceKey{}, err
	}
	return models.AlertInstanceKey{RuleOrgID: a.OrgID, RuleUID: a.AlertRuleUID, LabelsHash: labelsHash}, nil
}

func (a *State) setState(state eval.State, reason string, startsAt, endsAt time.Time, err error) {
	a.State = state
	a.StateReason = reason
	a.StartsAt = startsAt
	a.EndsAt = endsAt
	a.Error = err
}

// SetAlerting sets the state to Alerting. It changes both the start and end time.
func (a *State) SetAlerting(reason string, startsAt, endsAt time.Time, err error) {
	a.setState(eval.Alerting, reason, startsAt, endsAt, err)
}

// SetPending the state to Pending. It changes both the start and end time.
func (a *State) SetPending(reason string, startsAt, endsAt time.Time, err error) {
	a.setState(eval.Pending, reason, startsAt, endsAt, err)
}

// SetNoData sets the state to NoData. It changes both the start and end time.
func (a *State) SetNoData(startsAt, endsAt time.Time, err error) {
	a.setState(eval.NoData, models.StateReasonNoData, startsAt, endsAt, err)
}

// SetError sets the state to Error. It changes both the start and end time.
func (a *State) SetError(startsAt, endsAt time.Time, err error) {
	a.setState(eval.Error, models.StateReasonError, startsAt, endsAt, err)
}

// SetNormal sets the state to Normal. It changes both the start and end time.
func (a *State) SetNormal(reason string, startsAt, endsAt time.Time, err error) {
	a.setState(eval.Normal, reason, startsAt, endsAt, err)
}

// Resolve sets the State to Normal. It updates the StateReason, the end time, and sets Resolved to true.
func (a *State) Resolve(reason string, endsAt time.Time) {
	a.State = eval.Normal
	a.StateReason = reason
	a.Resolved = true
	a.EndsAt = endsAt
}

// Maintain updates the end time using the most recent evaluation.
func (a *State) Maintain(interval int64, evaluatedAt time.Time) {
	a.EndsAt = nextEndsTime(interval, evaluatedAt)
}

// IsNormalStateWithNoReason returns true if the state is Normal and reason is empty
func IsNormalStateWithNoReason(s *State) bool {
	return s.State == eval.Normal && s.StateReason == ""
}

// StateTransition describes the transition from one state to another.
type StateTransition struct {
	*State
	PreviousState       eval.State
	PreviousStateReason string
}

func (c StateTransition) Formatted() string {
	return FormatStateAndReason(c.State.State, c.State.StateReason)
}

func (c StateTransition) PreviousFormatted() string {
	return FormatStateAndReason(c.PreviousState, c.PreviousStateReason)
}

func (c StateTransition) Changed() bool {
	return c.PreviousState != c.State.State || c.PreviousStateReason != c.State.StateReason
}

type Evaluation struct {
	EvaluationTime  time.Time
	EvaluationState eval.State
	// Values contains the RefID and value of reduce and math expressions.
	// Classic conditions can have different values for the same RefID as they can include multiple conditions.
	// For these, we use the index of the condition in addition RefID as the key e.g. "A0, A1, A2, etc.".
	Values map[string]*float64
	// Condition is the refID specified as the condition in the alerting rule at the time of the evaluation.
	Condition string
}

// NewEvaluationValues returns the labels and values for each RefID in the capture.
func NewEvaluationValues(m map[string]eval.NumberValueCapture) map[string]*float64 {
	result := make(map[string]*float64, len(m))
	for k, v := range m {
		result[k] = v.Value
	}
	return result
}

func resultNormal(state *State, _ *models.AlertRule, result eval.Result, logger log.Logger, reason string) {
	if state.State == eval.Normal && state.StateReason == reason {
		logger.Debug("Keeping state", "state", state.State)
	} else {
		logger.Debug("Changing state", "previous_state", state.State, "next_state", eval.Normal)
		// Normal states have the same start and end timestamps
		state.SetNormal(reason, result.EvaluatedAt, result.EvaluatedAt, result.Error)
	}
}

func resultAlerting(state *State, rule *models.AlertRule, result eval.Result, logger log.Logger, reason string) {
	switch {
	case state.State == eval.Alerting && state.StateReason == reason:
		logger.Debug("Keeping state", "state", state.State)
		state.Maintain(rule.IntervalSeconds, result.EvaluatedAt)
	case state.State == eval.Pending && state.StateReason == reason:
		// If the previous state is Pending then check if the For duration has been observed
		if result.EvaluatedAt.Sub(state.StartsAt) >= rule.For {
			logger.Debug("Changing state", "previous_state", state.State, "next_state", eval.Alerting)
			state.SetAlerting(reason, result.EvaluatedAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt), result.Error)
		}
	default:
		if rule.For > 0 {
			// If the alert rule has a For duration that should be observed then the state should be set to Pending
			logger.Debug("Changing state", "previous_state", state.State, "next_state", eval.Pending)
			state.SetPending(reason, result.EvaluatedAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt), result.Error)
		} else {
			logger.Debug("Changing state", "previous_state", state.State, "next_state", eval.Alerting)
			state.SetAlerting(reason, result.EvaluatedAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt), result.Error)
		}
	}
}

func resultError(state *State, rule *models.AlertRule, result eval.Result, logger log.Logger) {
	switch rule.ExecErrState {
	case models.AlertingErrState:
		logger.Debug("Execution error state is Alerting", "handler", "resultAlerting", "previous_handler", "resultError")
		resultAlerting(state, rule, result, logger, models.StateReasonError)
	case models.ErrorErrState:
		if state.State == eval.Error {
			logger.Debug("Keeping state", "state", state.State)
			state.Maintain(rule.IntervalSeconds, result.EvaluatedAt)
		} else {
			// This is the first occurrence of an error
			logger.Debug("Changing state", "previous_state", state.State, "next_state", eval.Error)
			state.SetError(result.EvaluatedAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt), result.Error)

			if result.Error != nil {
				state.Annotations["Error"] = result.Error.Error()
				// If the evaluation failed because a query returned an error then add the Ref ID and
				// Datasource UID as labels
				var queryError expr.QueryError
				if errors.As(state.Error, &queryError) {
					for _, next := range rule.Data {
						if next.RefID == queryError.RefID {
							state.Labels["ref_id"] = next.RefID
							state.Labels["datasource_uid"] = next.DatasourceUID
							break
						}
					}
				}
			}
		}
	case models.OkErrState:
		logger.Debug("Execution error state is Normal", "handler", "resultNormal", "previous_handler", "resultError")
		resultNormal(state, rule, result, logger, models.StateReasonError)
	default:
		err := fmt.Errorf("unsupported execution error state: %s", rule.ExecErrState)
		state.SetError(state.StartsAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt), err)
		state.Annotations["Error"] = err.Error()
	}
}

func resultNoData(state *State, rule *models.AlertRule, result eval.Result, logger log.Logger) {
	switch rule.NoDataState {
	case models.Alerting:
		logger.Debug("Execution no data state is Alerting", "handler", "resultAlerting", "previous_handler", "resultNoData")
		resultAlerting(state, rule, result, logger, models.StateReasonNoData)
	case models.NoData:
		if state.State == eval.NoData {
			logger.Debug("Keeping state", "state", state.State)
			state.Maintain(rule.IntervalSeconds, result.EvaluatedAt)
		} else {
			// This is the first occurrence of no data
			logger.Debug("Changing state", "previous_state", state.State, "next_state", eval.NoData)
			state.SetNoData(result.EvaluatedAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt), nil)
		}
	case models.OK:
		logger.Debug("Execution no data state is Normal", "handler", "resultNormal", "previous_handler", "resultNoData")
		resultNormal(state, rule, result, logger, models.StateReasonNoData)
	default:
		err := fmt.Errorf("unsupported no data state: %s", rule.NoDataState)
		state.SetError(state.StartsAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt), err)
		state.Annotations["Error"] = err.Error()
	}
}

func (a *State) NeedsSending(resendDelay time.Duration) bool {
	switch a.State {
	case eval.Pending:
		// We do not send notifications for pending states
		return false
	case eval.Normal:
		// We should send a notification if the state is Normal because it was resolved
		return a.Resolved
	default:
		// We should send, and re-send notifications, each time LastSentAt is <= LastEvaluationTime + resendDelay
		nextSent := a.LastSentAt.Add(resendDelay)
		return nextSent.Before(a.LastEvaluationTime) || nextSent.Equal(a.LastEvaluationTime)
	}
}

func (a *State) Equals(b *State) bool {
	return a.AlertRuleUID == b.AlertRuleUID &&
		a.OrgID == b.OrgID &&
		a.CacheID == b.CacheID &&
		a.Labels.String() == b.Labels.String() &&
		a.State.String() == b.State.String() &&
		a.StartsAt == b.StartsAt &&
		a.EndsAt == b.EndsAt &&
		a.LastEvaluationTime == b.LastEvaluationTime &&
		data.Labels(a.Annotations).String() == data.Labels(b.Annotations).String()
}

func (a *State) TrimResults(alertRule *models.AlertRule) {
	numBuckets := int64(alertRule.For.Seconds()) / alertRule.IntervalSeconds
	if numBuckets == 0 {
		numBuckets = 10 // keep at least 10 evaluations in the event For is set to 0
	}

	if len(a.Results) < int(numBuckets) {
		return
	}
	newResults := make([]Evaluation, numBuckets)
	copy(newResults, a.Results[len(a.Results)-int(numBuckets):])
	a.Results = newResults
}

func nextEndsTime(interval int64, evaluatedAt time.Time) time.Time {
	ends := ResendDelay
	intv := time.Second * time.Duration(interval)
	if intv > ResendDelay {
		ends = intv
	}
	return evaluatedAt.Add(3 * ends)
}

func (a *State) GetLabels(opts ...models.LabelOption) map[string]string {
	labels := a.Labels.Copy()

	for _, opt := range opts {
		opt(labels)
	}

	return labels
}

func (a *State) GetLastEvaluationValuesForCondition() map[string]float64 {
	if len(a.Results) <= 0 {
		return nil
	}

	lastResult := a.Results[len(a.Results)-1]
	r := make(map[string]float64, len(lastResult.Values))

	for refID, value := range lastResult.Values {
		if strings.Contains(refID, lastResult.Condition) {
			if value != nil {
				r[refID] = *value
				continue
			}
			r[refID] = math.NaN()
		}
	}

	return r
}

// shouldTakeImage returns true if the state just has transitioned to alerting from another state,
// transitioned to alerting in a previous evaluation but does not have a screenshot, or has just
// been resolved.
func shouldTakeImage(state, previousState eval.State, previousImage *models.Image, resolved bool) bool {
	return resolved ||
		state == eval.Alerting && previousState != eval.Alerting ||
		state == eval.Alerting && previousImage == nil
}

// takeImage takes an image for the alert rule. It returns nil if screenshots are disabled or
// the rule is not associated with a dashboard panel.
func takeImage(ctx context.Context, s ImageCapturer, r *models.AlertRule) (*models.Image, error) {
	img, err := s.NewImage(ctx, r)
	if err != nil {
		if errors.Is(err, screenshot.ErrScreenshotsUnavailable) ||
			errors.Is(err, models.ErrNoDashboard) ||
			errors.Is(err, models.ErrNoPanel) {
			return nil, nil
		}
		return nil, err
	}
	return img, nil
}

func FormatStateAndReason(state eval.State, reason string) string {
	s := fmt.Sprintf("%v", state)
	if len(reason) > 0 && state.String() != reason {
		s += fmt.Sprintf(" (%v)", reason)
	}
	return s
}

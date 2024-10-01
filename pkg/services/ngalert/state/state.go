package state

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	prometheusModel "github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
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
	CacheID data.Fingerprint

	// State represents the current state.
	State eval.State

	// StateReason is a textual description to explain why the state has its current state.
	StateReason string

	// ResultFingerprint is a hash of labels of the result before it is processed by
	ResultFingerprint data.Fingerprint

	// LatestResult contains the result of the most recent evaluation, if available.
	LatestResult *Evaluation

	// Error is set if the current evaluation returned an error. If error is non-nil results
	// can still contain the results of previous evaluations.
	Error error

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

	StartsAt time.Time
	// EndsAt is different from the Prometheus EndsAt as EndsAt is updated for both Normal states
	// and states that have been resolved. It cannot be used to determine when a state was resolved.
	EndsAt time.Time
	// ResolvedAt is set when the state is first resolved. That is to say, when the state first transitions
	// from Alerting, NoData, or Error to Normal. It is reset to zero when the state transitions from Normal
	// to any other state.
	ResolvedAt           *time.Time
	LastSentAt           *time.Time
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

// SetAlerting sets the state to Alerting. It changes both the start and end time.
func (a *State) SetAlerting(reason string, startsAt, endsAt time.Time) {
	a.State = eval.Alerting
	a.StateReason = reason
	a.StartsAt = startsAt
	a.EndsAt = endsAt
	a.Error = nil
}

// SetPending the state to Pending. It changes both the start and end time.
func (a *State) SetPending(reason string, startsAt, endsAt time.Time) {
	a.State = eval.Pending
	a.StateReason = reason
	a.StartsAt = startsAt
	a.EndsAt = endsAt
	a.Error = nil
}

// SetNoData sets the state to NoData. It changes both the start and end time.
func (a *State) SetNoData(reason string, startsAt, endsAt time.Time) {
	a.State = eval.NoData
	a.StateReason = reason
	a.StartsAt = startsAt
	a.EndsAt = endsAt
	a.Error = nil
}

// SetError sets the state to Error. It changes both the start and end time.
func (a *State) SetError(err error, startsAt, endsAt time.Time) {
	a.State = eval.Error
	a.StateReason = models.StateReasonError
	a.StartsAt = startsAt
	a.EndsAt = endsAt
	a.Error = err
}

// SetNormal sets the state to Normal. It changes both the start and end time.
func (a *State) SetNormal(reason string, startsAt, endsAt time.Time) {
	a.State = eval.Normal
	a.StateReason = reason
	a.StartsAt = startsAt
	a.EndsAt = endsAt
	a.Error = nil
}

// Maintain updates the end time using the most recent evaluation.
func (a *State) Maintain(interval int64, evaluatedAt time.Time) {
	a.EndsAt = nextEndsTime(interval, evaluatedAt)
}

// AddErrorInformation adds annotations to the state to indicate that an error occurred.
// If addDatasourceInfoToLabels is true, the ref_id and datasource_uid are added to the labels,
// otherwise, they are added to the annotations.
func (a *State) AddErrorInformation(err error, rule *models.AlertRule, addDatasourceInfoToLabels bool) {
	if err == nil {
		return
	}

	a.Annotations["Error"] = err.Error()

	// If the evaluation failed because a query returned an error then add the Ref ID and
	// Datasource UID as labels or annotations
	var utilError errutil.Error
	if errors.As(err, &utilError) &&
		(errors.Is(err, expr.QueryError) || errors.Is(err, expr.ConversionError)) {
		for _, next := range rule.Data {
			if next.RefID == utilError.PublicPayload["refId"].(string) {
				if addDatasourceInfoToLabels {
					a.Labels["ref_id"] = next.RefID
					a.Labels["datasource_uid"] = next.DatasourceUID
				} else {
					a.Annotations["ref_id"] = next.RefID
					a.Annotations["datasource_uid"] = next.DatasourceUID
				}
				break
			}
		}
	} else {
		// Remove the ref_id and datasource_uid from the annotations if they are present.
		// It can happen if the alert state hasn't changed, but the error is different now.
		delete(a.Annotations, "ref_id")
		delete(a.Annotations, "datasource_uid")
	}
}

func (a *State) SetNextValues(result eval.Result) {
	const sentinel = float64(-1)

	// We try to provide a reasonable object for Values in the event of nodata/error.
	// In order to not break templates that might refer to refIDs,
	// we instead fill values with the latest known set of refIDs, but with a sentinel -1 to indicate that the value didn't exist.
	if result.State == eval.NoData || result.State == eval.Error {
		placeholder := make(map[string]float64, len(a.Values))
		for refID := range a.Values {
			placeholder[refID] = sentinel
		}
		a.Values = placeholder
		return
	}

	newValues := make(map[string]float64, len(result.Values))
	for k, v := range result.Values {
		if v.Value != nil {
			newValues[k] = *v.Value
		} else {
			newValues[k] = math.NaN()
		}
	}
	a.Values = newValues
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

type StateTransitions []StateTransition

// StaleStates returns the subset of StateTransitions that are stale.
func (c StateTransitions) StaleStates() StateTransitions {
	var result StateTransitions
	for _, t := range c {
		if t.IsStale() {
			result = append(result, t)
		}
	}
	return result
}

type Evaluation struct {
	EvaluationTime  time.Time
	EvaluationState eval.State
	// Values contains the RefID and value of reduce and math expressions.
	// Classic conditions can have different values for the same RefID as they can include multiple conditions.
	// For these, we use the index of the condition in addition RefID as the key e.g. "A0, A1, A2, etc.".
	Values map[string]float64
	// Condition is the refID specified as the condition in the alerting rule at the time of the evaluation.
	Condition string
}

// NewEvaluationValues returns the labels and values for each RefID in the capture.
func NewEvaluationValues(m map[string]eval.NumberValueCapture) map[string]float64 {
	result := make(map[string]float64, len(m))
	for k, v := range m {
		if v.Value != nil {
			result[k] = *v.Value
		} else {
			result[k] = math.NaN()
		}
	}
	return result
}

func resultNormal(state *State, _ *models.AlertRule, result eval.Result, logger log.Logger, reason string) {
	if state.State == eval.Normal {
		logger.Debug("Keeping state", "state", state.State)
	} else {
		nextEndsAt := result.EvaluatedAt
		logger.Debug("Changing state",
			"previous_state",
			state.State,
			"next_state",
			eval.Normal,
			"previous_ends_at",
			state.EndsAt,
			"next_ends_at",
			nextEndsAt)
		// Normal states have the same start and end timestamps
		state.SetNormal(reason, nextEndsAt, nextEndsAt)
	}
}

func resultAlerting(state *State, rule *models.AlertRule, result eval.Result, logger log.Logger, reason string) {
	switch state.State {
	case eval.Alerting:
		prevEndsAt := state.EndsAt
		state.Maintain(rule.IntervalSeconds, result.EvaluatedAt)
		logger.Debug("Keeping state",
			"state",
			state.State,
			"previous_ends_at",
			prevEndsAt,
			"next_ends_at",
			state.EndsAt)
	case eval.Pending:
		// If the previous state is Pending then check if the For duration has been observed
		if result.EvaluatedAt.Sub(state.StartsAt) >= rule.For {
			nextEndsAt := nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt)
			logger.Debug("Changing state",
				"previous_state",
				state.State,
				"next_state",
				eval.Alerting,
				"previous_ends_at",
				state.EndsAt,
				"next_ends_at",
				nextEndsAt)
			state.SetAlerting(reason, result.EvaluatedAt, nextEndsAt)
		}
	default:
		nextEndsAt := nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt)
		if rule.For > 0 {
			// If the alert rule has a For duration that should be observed then the state should be set to Pending
			logger.Debug("Changing state",
				"previous_state",
				state.State,
				"next_state",
				eval.Pending,
				"previous_ends_at",
				state.EndsAt,
				"next_ends_at",
				nextEndsAt)
			state.SetPending(reason, result.EvaluatedAt, nextEndsAt)
		} else {
			logger.Debug("Changing state",
				"previous_state",
				state.State,
				"next_state",
				eval.Alerting,
				"previous_ends_at",
				state.EndsAt,
				"next_ends_at",
				nextEndsAt)
			state.SetAlerting(reason, result.EvaluatedAt, nextEndsAt)
		}
	}
}

func resultError(state *State, rule *models.AlertRule, result eval.Result, logger log.Logger) {
	handlerStr := "resultError"

	switch rule.ExecErrState {
	case models.AlertingErrState:
		logger.Debug("Execution error state is Alerting", "handler", "resultAlerting", "previous_handler", handlerStr)
		resultAlerting(state, rule, result, logger, models.StateReasonError)
		// This is a special case where Alerting and Pending should also have an error and reason
		state.Error = result.Error
		state.AddErrorInformation(result.Error, rule, false)
	case models.ErrorErrState:
		if state.State == eval.Error {
			prevEndsAt := state.EndsAt
			state.Error = result.Error
			state.AddErrorInformation(result.Error, rule, true)
			state.Maintain(rule.IntervalSeconds, result.EvaluatedAt)
			logger.Debug("Keeping state",
				"state",
				state.State,
				"previous_ends_at",
				prevEndsAt,
				"next_ends_at",
				state.EndsAt)
		} else {
			nextEndsAt := nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt)
			// This is the first occurrence of an error
			logger.Debug("Changing state",
				"previous_state",
				state.State,
				"next_state",
				eval.Error,
				"previous_ends_at",
				state.EndsAt,
				"next_ends_at",
				nextEndsAt)
			state.SetError(result.Error, result.EvaluatedAt, nextEndsAt)
			state.AddErrorInformation(result.Error, rule, true)
		}
	case models.OkErrState:
		logger.Debug("Execution error state is Normal", "handler", "resultNormal", "previous_handler", handlerStr)
		resultNormal(state, rule, result, logger, "") // TODO: Should we add a reason?
		state.AddErrorInformation(result.Error, rule, false)
	case models.KeepLastErrState:
		logger := logger.New("previous_handler", handlerStr)
		resultKeepLast(state, rule, result, logger)
		state.AddErrorInformation(result.Error, rule, false)
	default:
		err := fmt.Errorf("unsupported execution error state: %s", rule.ExecErrState)
		state.SetError(err, state.StartsAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt))
		state.AddErrorInformation(result.Error, rule, false)
	}
}

func resultNoData(state *State, rule *models.AlertRule, result eval.Result, logger log.Logger) {
	handlerStr := "resultNoData"

	switch rule.NoDataState {
	case models.Alerting:
		logger.Debug("Execution no data state is Alerting", "handler", "resultAlerting", "previous_handler", handlerStr)
		resultAlerting(state, rule, result, logger, models.StateReasonNoData)
	case models.NoData:
		if state.State == eval.NoData {
			prevEndsAt := state.EndsAt
			state.Maintain(rule.IntervalSeconds, result.EvaluatedAt)
			logger.Debug("Keeping state",
				"state",
				state.State,
				"previous_ends_at",
				prevEndsAt,
				"next_ends_at",
				state.EndsAt)
		} else {
			// This is the first occurrence of no data
			nextEndsAt := nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt)
			logger.Debug("Changing state",
				"previous_state",
				state.State,
				"next_state",
				eval.NoData,
				"previous_ends_at",
				state.EndsAt,
				"next_ends_at",
				nextEndsAt)
			state.SetNoData("", result.EvaluatedAt, nextEndsAt)
		}
	case models.OK:
		logger.Debug("Execution no data state is Normal", "handler", "resultNormal", "previous_handler", handlerStr)
		resultNormal(state, rule, result, logger, models.StateReasonNoData)
	case models.KeepLast:
		logger := logger.New("previous_handler", handlerStr)
		resultKeepLast(state, rule, result, logger)
	default:
		err := fmt.Errorf("unsupported no data state: %s", rule.NoDataState)
		state.SetError(err, state.StartsAt, nextEndsTime(rule.IntervalSeconds, result.EvaluatedAt))
		state.Annotations["Error"] = err.Error()
	}
}

func resultKeepLast(state *State, rule *models.AlertRule, result eval.Result, logger log.Logger) {
	reason := models.ConcatReasons(result.State.String(), models.StateReasonKeepLast)

	switch state.State {
	case eval.Alerting:
		logger.Debug("Execution keep last state is Alerting", "handler", "resultAlerting")
		resultAlerting(state, rule, result, logger, reason)
	case eval.Pending:
		// respect 'for' setting on rule
		if result.EvaluatedAt.Sub(state.StartsAt) >= rule.For {
			logger.Debug("Execution keep last state is Pending", "handler", "resultAlerting")
			resultAlerting(state, rule, result, logger, reason)
		} else {
			logger.Debug("Ignoring set next state to pending")
		}
	case eval.Normal:
		logger.Debug("Execution keep last state is Normal", "handler", "resultNormal")
		resultNormal(state, rule, result, logger, reason)
	default:
		// this should not happen, add as failsafe
		logger.Debug("Reverting invalid state to normal", "handler", "resultNormal")
		resultNormal(state, rule, result, logger, reason)
	}
}

// NeedsSending returns true if the given state needs to be sent to the Alertmanager.
// Reasons for sending include:
// - The state has been resolved since the last notification.
// - The state is firing and the last notification was sent at least resendDelay ago.
// - The state was resolved within the resolvedRetention period, and the last notification was sent at least resendDelay ago.
func (a *State) NeedsSending(resendDelay time.Duration, resolvedRetention time.Duration) bool {
	if a.State == eval.Pending {
		// We do not send notifications for pending states.
		return false
	}

	// We should send a notification if the state has been resolved since the last notification.
	if a.ResolvedAt != nil && (a.LastSentAt == nil || a.ResolvedAt.After(*a.LastSentAt)) {
		return true
	}

	// For normal states, we should only be sending if this is a resolved notification or a re-send of the resolved
	// notification within the resolvedRetention period.
	if a.State == eval.Normal && (a.ResolvedAt == nil || a.LastEvaluationTime.Sub(*a.ResolvedAt) > resolvedRetention) {
		return false
	}

	// We should send, and re-send notifications, each time LastSentAt is <= LastEvaluationTime + resendDelay.
	// This can include normal->normal transitions that were resolved in recent past evaluations.
	return a.LastSentAt == nil || !a.LastSentAt.Add(resendDelay).After(a.LastEvaluationTime)
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

func nextEndsTime(interval int64, evaluatedAt time.Time) time.Time {
	ends := ResendDelay
	intv := time.Second * time.Duration(interval)
	if intv > ResendDelay {
		ends = intv
	}
	// Allow for at least two evaluation cycles to pass before expiring, every time.
	// Synchronized with Prometheus:
	// https://github.com/prometheus/prometheus/blob/6a9b3263ffdba5ea8c23e6f9ef69fb7a15b566f8/rules/alerting.go#L493
	return evaluatedAt.Add(4 * ends)
}

func (a *State) GetLabels(opts ...models.LabelOption) map[string]string {
	labels := a.Labels.Copy()

	for _, opt := range opts {
		opt(labels)
	}

	return labels
}

func (a *State) GetLastEvaluationValuesForCondition() map[string]float64 {
	if a.LatestResult == nil {
		return nil
	}

	lastResult := *a.LatestResult
	r := make(map[string]float64, len(lastResult.Values))

	for refID, value := range lastResult.Values {
		if strings.Contains(refID, lastResult.Condition) {
			r[refID] = value
		}
	}

	return r
}

// IsStale returns true if the state is stale, meaning that the state is ready to be evicted from the cache.
func (a *State) IsStale() bool {
	return a.StateReason == models.StateReasonMissingSeries
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
	if len(reason) > 0 {
		s += fmt.Sprintf(" (%v)", reason)
	}
	return s
}

// ParseFormattedState parses a state string in the format "state (reason)"
// and returns the state and reason separately.
func ParseFormattedState(stateStr string) (eval.State, string, error) {
	p := 0
	// walk string until we find a space
	for i, c := range stateStr {
		if c == ' ' {
			p = i
			break
		}
	}
	if p == 0 {
		p = len(stateStr)
	}

	state, err := eval.ParseStateString(stateStr[:p])
	if err != nil {
		return -1, "", err
	}

	if p == len(stateStr) {
		return state, "", nil
	}

	reason := strings.Trim(stateStr[p+1:], "()")
	return state, reason, nil
}

// GetRuleExtraLabels returns a map of built-in labels that should be added to an alert before it is sent to the Alertmanager or its state is cached.
func GetRuleExtraLabels(l log.Logger, rule *models.AlertRule, folderTitle string, includeFolder bool) map[string]string {
	extraLabels := make(map[string]string, 4)

	extraLabels[alertingModels.NamespaceUIDLabel] = rule.NamespaceUID
	extraLabels[prometheusModel.AlertNameLabel] = rule.Title
	extraLabels[alertingModels.RuleUIDLabel] = rule.UID

	if includeFolder {
		extraLabels[models.FolderTitleLabel] = folderTitle
	}

	if len(rule.NotificationSettings) > 0 {
		// Notification settings are defined as a slice to workaround xorm behavior.
		// Any items past the first should not exist so we ignore them.
		if len(rule.NotificationSettings) > 1 {
			ignored, _ := json.Marshal(rule.NotificationSettings[1:])
			l.Error("Detected multiple notification settings, which is not supported. Only the first will be applied", "ignored_settings", string(ignored))
		}
		return mergeLabels(extraLabels, rule.NotificationSettings[0].ToLabels())
	}
	return extraLabels
}

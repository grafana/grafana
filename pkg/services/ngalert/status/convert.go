package status

import (
	"strings"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	apiprometheus "github.com/grafana/grafana/pkg/services/ngalert/api/prometheus"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

// toAlertRuleStatus builds the k8s AlertRule status from the rule's instance states.
// state/reason/health/timestamps are all derived from the state manager, so it works
// on any node that holds the state (in-memory or DB-backed) without the scheduler.
func toAlertRuleStatus(states []*state.State, paused bool) model.AlertRuleStatus {
	reason := alertReason(states)

	// No instances means the rule hasn't been evaluated yet. ComputeRuleState and
	// StatesToRuleStatus can't distinguish this from an all-normal rule (both report
	// Normal/"ok"), so it must be handled explicitly.
	if len(states) == 0 {
		st := model.AlertRuleAlertRuleStateInactive
		h := model.AlertRuleAlertRuleHealthNotScheduled
		if paused {
			h = model.AlertRuleAlertRuleHealthPaused
		}
		return model.AlertRuleStatus{State: &st, Health: &h, StateReason: &reason}
	}

	rs := state.StatesToRuleStatus(states)
	ruleState := alertState(apiprometheus.ComputeRuleState(states))
	health := alertHealth(rs.Health)
	if paused {
		ruleState = model.AlertRuleAlertRuleStateInactive
		health = model.AlertRuleAlertRuleHealthPaused
	}

	out := model.AlertRuleStatus{
		State:       &ruleState,
		StateReason: &reason,
		Health:      &health,
	}
	if !rs.EvaluationTimestamp.IsZero() {
		t := rs.EvaluationTimestamp
		out.LastEvaluationTime = &t
	}
	if rs.EvaluationDuration > 0 {
		d := rs.EvaluationDuration.Seconds()
		out.EvaluationDuration = &d
	}
	if rs.LastError != nil {
		e := rs.LastError.Error()
		out.LastError = &e
	}
	return out
}

// toRecordingRuleStatus builds the k8s RecordingRule status from the scheduler's
// per-rule status. Recording rules produce no instances, so the scheduler is the only
// source; found is false when the scheduler isn't tracking the rule (not scheduled).
func toRecordingRuleStatus(rs ngmodels.RuleStatus, found, paused bool) model.RecordingRuleStatus {
	health := recordingHealth(rs.Health, paused, found)

	out := model.RecordingRuleStatus{
		Health: &health,
	}
	if !rs.EvaluationTimestamp.IsZero() {
		t := rs.EvaluationTimestamp
		out.LastEvaluationTime = &t
	}
	if rs.EvaluationDuration > 0 {
		d := rs.EvaluationDuration.Seconds()
		out.EvaluationTime = &d
	}
	if rs.LastError != nil {
		e := rs.LastError.Error()
		out.LastError = &e
	}
	return out
}

func alertState(s eval.State) model.AlertRuleAlertRuleState {
	switch s {
	case eval.Alerting:
		return model.AlertRuleAlertRuleStateFiring
	case eval.Pending:
		return model.AlertRuleAlertRuleStatePending
	case eval.Recovering:
		return model.AlertRuleAlertRuleStateRecovering
	case eval.Normal:
		return model.AlertRuleAlertRuleStateHealthy
	default:
		return model.AlertRuleAlertRuleStateInactive
	}
}

func alertReason(states []*state.State) model.AlertRuleAlertRuleStateReason {
	for _, s := range states {
		// StateReason may be a comma-joined set (models.ConcatReasons), so match a substring.
		if strings.Contains(s.StateReason, ngmodels.StateReasonKeepLast) {
			return model.AlertRuleAlertRuleStateReasonKeepLast
		}
	}
	return model.AlertRuleAlertRuleStateReasonEvaluated
}

func alertHealth(health string) model.AlertRuleAlertRuleHealth {
	switch health {
	case "error":
		return model.AlertRuleAlertRuleHealthError
	case "nodata":
		return model.AlertRuleAlertRuleHealthNoData
	case "ok":
		return model.AlertRuleAlertRuleHealthOK
	default:
		return model.AlertRuleAlertRuleHealthNotScheduled
	}
}

func recordingHealth(health string, paused, found bool) model.RecordingRuleRecordingRuleHealth {
	if paused {
		return model.RecordingRuleRecordingRuleHealthPaused
	}

	if !found {
		return model.RecordingRuleRecordingRuleHealthNotScheduled
	}

	switch health {
	case "error":
		return model.RecordingRuleRecordingRuleHealthError
	case "nodata":
		return model.RecordingRuleRecordingRuleHealthNoData
	case "ok":
		return model.RecordingRuleRecordingRuleHealthRecording
	default:
		// In this case we know about the rule but it hasn't been evaluated
		// yet so we consider it to be NotScheduled
		return model.RecordingRuleRecordingRuleHealthNotScheduled
	}
}

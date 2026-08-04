package status

import (
	"strings"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	apiprometheus "github.com/grafana/grafana/pkg/services/ngalert/api/prometheus"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func ptr[T any](v T) *T { return &v }

// toAlertRuleStatus builds the k8s AlertRule status from the rule's instance states.
// state/reason/health/timestamps are all derived from the state manager, so it works
// on any node that holds the state (in-memory or DB-backed) without the scheduler.
func toAlertRuleStatus(states []*state.State, paused bool) model.AlertRuleStatus {
	out := model.AlertRuleStatus{}
	out.StateReason = ptr(alertReason(states))
	if len(states) == 0 {
		out.Health = ptr(model.AlertRuleAlertRuleHealthNotScheduled)
		out.State = ptr(model.AlertRuleAlertRuleStateInactive)
		if paused {
			out.Health = ptr(model.AlertRuleAlertRuleHealthPaused)
		}

		return out
	}

	rs := state.StatesToRuleStatus(states)
	out.LastEvaluationTime = &rs.EvaluationTimestamp
	out.EvaluationDuration = ptr(rs.EvaluationDuration.Seconds())
	if rs.LastError != nil {
		out.LastError = ptr(rs.LastError.Error())
	}

	if paused {
		out.Health = ptr(model.AlertRuleAlertRuleHealthPaused)
		out.State = ptr(model.AlertRuleAlertRuleStateInactive)
		return out
	}

	out.State = ptr(alertState(apiprometheus.ComputeRuleState(states)))
	out.Health = ptr(alertHealth(rs.Health))

	return out
}

// toRecordingRuleStatus builds the k8s RecordingRule status from the scheduler's
// per-rule status. Recording rules produce no instances, so the scheduler is the only
// source; found is false when the scheduler isn't tracking the rule (not scheduled).
func toRecordingRuleStatus(rs ngmodels.RuleStatus, found, paused bool) model.RecordingRuleStatus {
	out := model.RecordingRuleStatus{
		Health:             ptr(recordingHealth(rs.Health, paused, found)),
		EvaluationDuration: ptr(rs.EvaluationDuration.Seconds()),
		LastEvaluationTime: &rs.EvaluationTimestamp,
	}

	if rs.LastError != nil {
		out.LastError = ptr(rs.LastError.Error())
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

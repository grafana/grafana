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
func toAlertRuleStatus(base model.AlertRuleStatus, states []*state.State, paused bool) model.AlertRuleStatus {
	base.State = nil
	base.Health = nil
	base.StateReason = new(alertReason(states))
	base.LastEvaluationTime = nil
	base.EvaluationDuration = nil
	base.LastError = nil

	if len(states) == 0 {
		base.Health = new(model.AlertRuleAlertRuleHealthNotScheduled)
		base.State = new(model.AlertRuleAlertRuleStateInactive)
		if paused {
			base.Health = new(model.AlertRuleAlertRuleHealthPaused)
		}
		return base
	}

	rs := state.StatesToRuleStatus(states)
	base.LastEvaluationTime = &rs.EvaluationTimestamp
	base.EvaluationDuration = new(rs.EvaluationDuration.Seconds())
	if rs.LastError != nil {
		base.LastError = new(rs.LastError.Error())
	}

	if paused {
		base.Health = new(model.AlertRuleAlertRuleHealthPaused)
		base.State = new(model.AlertRuleAlertRuleStateInactive)
		return base
	}

	base.State = new(alertState(apiprometheus.ComputeRuleState(states)))
	base.Health = new(alertHealth(rs.Health))
	return base
}

// toRecordingRuleStatus builds the k8s RecordingRule status from the scheduler's
// per-rule status. Recording rules produce no instances, so the scheduler is the only
// source; found is false when the scheduler isn't tracking the rule (not scheduled).
func toRecordingRuleStatus(base model.RecordingRuleStatus, rs ngmodels.RuleStatus, found, paused bool) model.RecordingRuleStatus {
	base.Health = new(recordingHealth(rs.Health, paused, found))
	base.LastEvaluationTime = &rs.EvaluationTimestamp
	base.EvaluationDuration = new(rs.EvaluationDuration.Seconds())
	base.LastError = nil
	if rs.LastError != nil {
		base.LastError = new(rs.LastError.Error())
	}
	return base
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

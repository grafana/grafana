package historian

import (
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

func shouldRecord(transition state.StateTransition) bool {
	if !transition.Changed() {
		return false
	}

	// Do not log not transitioned states normal states if it was marked as stale
	if transition.StateReason == models.StateReasonMissingSeries && transition.PreviousState == eval.Normal && transition.State.State == eval.Normal {
		return false
	}
	// Do not log transition from Normal (Paused|Updated) to Normal
	if transition.State.State == eval.Normal && transition.StateReason == "" &&
		transition.PreviousState == eval.Normal && (transition.PreviousStateReason == models.StateReasonPaused || transition.PreviousStateReason == models.StateReasonUpdated) {
		return false
	}
	return true
}

func removePrivateLabels(labels data.Labels) data.Labels {
	result := make(data.Labels)
	for k, v := range labels {
		if !strings.HasPrefix(k, "__") && !strings.HasSuffix(k, "__") {
			result[k] = v
		}
	}
	return result
}

// panelKey uniquely identifies a panel.
type panelKey struct {
	orgID   int64
	dashUID string
	panelID int64
}

// panelKey attempts to get the key of the panel attached to the given rule. Returns nil if the rule is not attached to a panel.
func parsePanelKey(rule history_model.RuleMeta, logger log.Logger) *panelKey {
	if rule.DashboardUID != "" {
		return &panelKey{
			orgID:   rule.OrgID,
			dashUID: rule.DashboardUID,
			panelID: rule.PanelID,
		}
	}
	return nil
}

func mergeLabels(base, into data.Labels) data.Labels {
	for k, v := range into {
		base[k] = v
	}
	return base
}

package schedule

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

var _ eval.AlertingResultsReader = AlertingResultsFromRuleState{}

func (a *alertRule) newLoadedMetricsReader(rule *ngmodels.AlertRule) eval.AlertingResultsReader {
	return &AlertingResultsFromRuleState{
		Manager: a.stateManager,
		Rule:    rule,
	}
}

type RuleStateProvider interface {
	GetStatesForRuleUID(orgID int64, alertRuleUID string) []*state.State
}

// AlertingResultsFromRuleState implements eval.AlertingResultsReader that gets the data from state manager.
// It returns results fingerprints only for Alerting and Pending states that have empty StateReason.
type AlertingResultsFromRuleState struct {
	Manager RuleStateProvider
	Rule    *ngmodels.AlertRule
}

func (n AlertingResultsFromRuleState) Read() map[data.Fingerprint]struct{} {
	states := n.Manager.GetStatesForRuleUID(n.Rule.OrgID, n.Rule.UID)

	active := map[data.Fingerprint]struct{}{}
	for _, st := range states {
		if st.StateReason != "" {
			continue
		}
		if st.State == eval.Alerting || st.State == eval.Pending {
			active[st.ResultFingerprint] = struct{}{}
		}
	}
	return active
}

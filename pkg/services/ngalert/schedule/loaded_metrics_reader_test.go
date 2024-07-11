package schedule

import (
	"testing"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func TestLoadedResultsFromRuleState(t *testing.T) {
	rule := ngmodels.RuleGen.GenerateRef()
	p := &FakeRuleStateProvider{
		map[ngmodels.AlertRuleKey][]*state.State{
			rule.GetKey(): {
				{State: eval.Alerting, ResultFingerprint: data.Fingerprint(1)},
				{State: eval.Pending, ResultFingerprint: data.Fingerprint(2)},
				{State: eval.Normal, ResultFingerprint: data.Fingerprint(3)},
				{State: eval.NoData, ResultFingerprint: data.Fingerprint(4)},
				{State: eval.Error, ResultFingerprint: data.Fingerprint(5)},
			},
		},
	}

	reader := AlertingResultsFromRuleState{
		Manager: p,
		Rule:    rule,
	}

	t.Run("should return pending and alerting states", func(t *testing.T) {
		loaded := reader.Read()
		require.Len(t, loaded, 2)
		require.Contains(t, loaded, data.Fingerprint(1))
		require.Contains(t, loaded, data.Fingerprint(2))
	})

	t.Run("should not return any states with reason", func(t *testing.T) {
		for _, s := range p.states[rule.GetKey()] {
			s.StateReason = uuid.NewString()
		}
		loaded := reader.Read()
		require.Empty(t, loaded)
	})

	t.Run("empty if no states", func(t *testing.T) {
		p.states[rule.GetKey()] = nil
		loaded := reader.Read()
		require.Empty(t, loaded)
	})
}

type FakeRuleStateProvider struct {
	states map[ngmodels.AlertRuleKey][]*state.State
}

func (f FakeRuleStateProvider) GetStatesForRuleUID(orgID int64, UID string) []*state.State {
	return f.states[ngmodels.AlertRuleKey{
		OrgID: orgID,
		UID:   UID,
	}]
}

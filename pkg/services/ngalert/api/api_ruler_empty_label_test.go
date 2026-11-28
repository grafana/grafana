package api

import (
	"testing"

	"github.com/stretchr/testify/require"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

func TestValidateNoNewEmptyLabelKeys(t *testing.T) {
	withLabels := func(l map[string]string) *ngmodels.AlertRule {
		return &ngmodels.AlertRule{UID: "uid", Title: "rule", Labels: l}
	}

	t.Run("rejects new rule with empty label key", func(t *testing.T) {
		err := validateNoNewEmptyLabelKeys(&rulestore.GroupDelta{New: []*ngmodels.AlertRule{withLabels(map[string]string{"": "x"})}})
		require.ErrorIs(t, err, ngmodels.ErrAlertRuleFailedValidation)
		require.ErrorContains(t, err, "label key cannot be empty")
	})

	t.Run("rejects update that introduces empty label key", func(t *testing.T) {
		err := validateNoNewEmptyLabelKeys(&rulestore.GroupDelta{Update: []rulestore.RuleDelta{{
			Existing: withLabels(map[string]string{"team": "sre"}),
			New:      withLabels(map[string]string{"": "x", "team": "sre"}),
		}}})
		require.ErrorContains(t, err, "label key cannot be empty")
		require.ErrorContains(t, err, "uid")
	})

	t.Run("allows update of rule that already had empty label key", func(t *testing.T) {
		err := validateNoNewEmptyLabelKeys(&rulestore.GroupDelta{Update: []rulestore.RuleDelta{{
			Existing: withLabels(map[string]string{"": "x"}),
			New:      withLabels(map[string]string{"": "x", "team": "sre"}),
		}}})
		require.NoError(t, err)
	})
}

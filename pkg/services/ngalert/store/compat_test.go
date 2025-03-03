package store

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestAlertRuleToModelsAlertRule(t *testing.T) {
	g := ngmodels.RuleGen

	t.Run("make sure no data is lost between conversions", func(t *testing.T) {
		for _, rule := range g.GenerateMany(100) {
			r, err := alertRuleFromModelsAlertRule(rule)
			require.NoError(t, err)
			clone, err := alertRuleToModelsAlertRule(r, &logtest.Fake{})
			require.NoError(t, err)
			require.Empty(t, rule.Diff(&clone))
		}
	})

	t.Run("should use NoData if NoDataState is not known", func(t *testing.T) {
		rule, err := alertRuleFromModelsAlertRule(g.Generate())
		require.NoError(t, err)
		rule.NoDataState = util.GenerateShortUID()

		converted, err := alertRuleToModelsAlertRule(rule, &logtest.Fake{})
		require.NoError(t, err)
		require.Equal(t, ngmodels.NoData, converted.NoDataState)
	})

	t.Run("should use Error if ExecErrState is not known", func(t *testing.T) {
		rule, err := alertRuleFromModelsAlertRule(g.Generate())
		require.NoError(t, err)
		rule.ExecErrState = util.GenerateShortUID()

		converted, err := alertRuleToModelsAlertRule(rule, &logtest.Fake{})
		require.NoError(t, err)
		require.Equal(t, ngmodels.ErrorErrState, converted.ExecErrState)
	})
}

func TestAlertRuleVersionToAlertRule(t *testing.T) {
	g := ngmodels.RuleGen

	t.Run("make sure no data is lost between conversions", func(t *testing.T) {
		for _, rule := range g.GenerateMany(100) {
			// ignore fields
			rule.DashboardUID = nil
			rule.PanelID = nil

			r, err := alertRuleFromModelsAlertRule(rule)
			require.NoError(t, err)
			r2 := alertRuleVersionToAlertRule(alertRuleToAlertRuleVersion(r))
			require.Equal(t, r, r2)
		}
	})
}

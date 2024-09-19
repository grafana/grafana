package validation

import (
	"testing"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
)

func TestValidateRule(t *testing.T) {
	recordGen := ngmodels.RuleGen.With(ngmodels.RuleGen.WithAllRecordingRules())

	t.Run("validates metric name on recording rules", func(t *testing.T) {
		rule := recordGen.Generate()
		rule.Record.Metric = "invalid metric name"
		_, err := ValidateRule(rule)
		require.ErrorIs(t, err, ngmodels.ErrAlertRuleFailedValidation)
	})

	t.Run("validation also clears ignored fields on recording rules", func(t *testing.T) {
		rule := recordGen.Generate()
		rule, err := ValidateRule(rule)
		require.NoError(t, err)
		require.Empty(t, rule.NoDataState)
		require.Empty(t, rule.ExecErrState)
		require.Empty(t, rule.Condition)
		require.Zero(t, rule.For)
		require.Nil(t, rule.NotificationSettings)
	})
}

package definitions

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestToModel(t *testing.T) {
	t.Run("if no rules are provided the rule field should be nil", func(t *testing.T) {
		ruleGroup := AlertRuleGroup{
			Title:     "123",
			FolderUID: "123",
			Interval:  10,
		}
		tm, err := ruleGroup.ToModel()
		require.NoError(t, err)
		require.Nil(t, tm.Rules)
	})
	t.Run("if rules are provided the rule field should be not nil", func(t *testing.T) {
		ruleGroup := AlertRuleGroup{
			Title:     "123",
			FolderUID: "123",
			Interval:  10,
			Rules: []ProvisionedAlertRule{
				{
					UID: "1",
				},
			},
		}
		tm, err := ruleGroup.ToModel()
		require.NoError(t, err)
		require.Len(t, tm.Rules, 1)
	})
}

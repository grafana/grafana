package rules

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestValidateAlertRuleForWrite(t *testing.T) {
	store := RuleStore{Cfg: setting.UnifiedAlertingSettings{BaseInterval: 10 * time.Second}}
	validRule := func() ngmodels.AlertRule {
		return ngmodels.AlertRule{
			OrgID:           1,
			UID:             "rule-uid",
			Title:           "rule",
			RuleGroup:       "group",
			NamespaceUID:    "folder",
			IntervalSeconds: 60,
			Condition:       "A",
			NoDataState:     ngmodels.NoData,
			ExecErrState:    ngmodels.ErrorErrState,
			Data: []ngmodels.AlertQuery{{
				RefID:         "A",
				DatasourceUID: "__expr__",
				Model:         json.RawMessage(`{"type":"math","expression":"1 == 1"}`),
			}},
		}
	}

	t.Run("accepts a valid rule without changing it", func(t *testing.T) {
		rule := validRule()
		model := string(rule.Data[0].Model)
		require.NoError(t, store.ValidateAlertRuleForWrite(rule))
		require.Equal(t, model, string(rule.Data[0].Model))
		require.True(t, rule.Updated.IsZero())
	})

	t.Run("rejects a rule group name longer than the column", func(t *testing.T) {
		rule := validRule()
		rule.RuleGroup = strings.Repeat("g", AlertRuleMaxRuleGroupNameLength+1)
		require.ErrorIs(t, store.ValidateAlertRuleForWrite(rule), ngmodels.ErrAlertRuleFailedValidation)
	})

	t.Run("rejects an interval that is not a multiple of the base interval", func(t *testing.T) {
		rule := validRule()
		rule.IntervalSeconds = 15
		require.ErrorIs(t, store.ValidateAlertRuleForWrite(rule), ngmodels.ErrAlertRuleFailedValidation)
	})

	t.Run("rejects a query model that PreSave cannot load", func(t *testing.T) {
		rule := validRule()
		rule.Data[0].Model = json.RawMessage(`not json`)
		require.ErrorIs(t, store.ValidateAlertRuleForWrite(rule), ngmodels.ErrAlertRuleFailedValidation)
	})
}

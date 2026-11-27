package foldertakeover

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alerting "github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var env = common.NewSharedGitEnv(
	common.WithRepositoryTypes([]string{"git", "local"}),
	func(opts *testinfra.GrafanaOpts) {
		opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagProvisioningMigrateFolderTakeover)
	},
)

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

// createAlertRule adds an alert rule to the folder. Provisioning cannot manage
// alert rules, so the folder is not taken over.
func createAlertRule(t *testing.T, helper *common.GitTestHelper, folderUID string) {
	t.Helper()
	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	api := alerting.NewAlertingLegacyAPIClient(addr, "admin", "admin")
	forDuration := model.Duration(10 * time.Second)
	group := apimodels.PostableRuleGroupConfig{
		Name:     "takeover-group",
		Interval: model.Duration(10 * time.Second),
		Rules: []apimodels.PostableExtendedRuleNode{{
			ApiRuleNode: &apimodels.ApiRuleNode{For: &forDuration},
			GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
				Title:     "rule-in-" + folderUID,
				Condition: "A",
				Data: []apimodels.AlertQuery{{
					RefID:         "A",
					DatasourceUID: expr.DatasourceUID,
					RelativeTimeRange: apimodels.RelativeTimeRange{
						From: apimodels.Duration(600 * time.Second),
						To:   0,
					},
					Model: json.RawMessage(`{"type":"math","expression":"2 + 3 > 1"}`),
				}},
			},
		}},
	}
	api.PostRulesGroup(t, folderUID, &group, false)
}

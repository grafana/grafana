package search

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const groupSortFolder = "group-sort-folder"

// TestIntegrationRuleSearchGroupSort verifies the cross-kind search interleaves
// the two rule kinds by group (ascending and descending) rather than grouping by
// kind.
//
// TODO: rules are seeded through the legacy provisioning API here because the
// k8s create path rejects a preset group label, and provisioning is the only
// way to land rules in specific groups today. That ties this test to the
// legacy-read dual-writer modes (0-2): provisioning writes to the SQL store,
// which the unified read path (mode 3+) would not see without a background sync.
// Once storage access moves behind the k8s client and setting the group at
// create time is allowed, seed via the k8s client instead and extend this to the
// unified modes.
func TestIntegrationRuleSearchGroupSort(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode2} {
		t.Run(fmt.Sprintf("dualWriterMode=%d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"alertrules.rules.alerting.grafana.app":     {DualWriterMode: mode},
					"recordingrules.rules.alerting.grafana.app": {DualWriterMode: mode},
				},
			})
			runGroupSortTests(t, helper)
		})
	}
}

func runGroupSortTests(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	common.CreateTestFolder(t, helper, groupSortFolder)
	legacyClient := alerting.NewAlertingLegacyAPIClient(helper.GetListenerAddress(), "admin", "admin")

	// Group names sort group-1 < group-2 < group-3 < group-4. Titles are in the
	// reverse order so a group-sorted result is distinguishable from a
	// title-sorted one, and the kinds alternate per group.
	seedAlertRuleGroup(t, legacyClient, "group-1", "zulu")
	seedRecordingRuleGroup(t, legacyClient, "group-2", "yankee", "metric_two")
	seedAlertRuleGroup(t, legacyClient, "group-3", "xray")
	seedRecordingRuleGroup(t, legacyClient, "group-4", "whiskey", "metric_four")

	rc := helper.Org1.Admin.RESTClient(t, &v0alpha1.GroupVersion)
	search := func(t *testing.T, sort string) v0alpha1.GetSearchRulesResponse {
		t.Helper()
		raw, err := rc.Get().
			AbsPath("apis", v0alpha1.APIGroup, v0alpha1.APIVersion, "namespaces", "default", "search").
			Param("sort", sort).
			DoRaw(ctx)
		require.NoError(t, err)
		var resp v0alpha1.GetSearchRulesResponse
		require.NoError(t, json.Unmarshal(raw, &resp))
		return resp
	}

	t.Run("ascending group order interleaves kinds", func(t *testing.T) {
		resp := search(t, "group")
		require.Equal(t, []string{"zulu", "yankee", "xray", "whiskey"}, crossKindTitles(resp))
		require.Equal(t, []string{"alertrule", "recordingrule", "alertrule", "recordingrule"}, crossKindKinds(resp))
	})

	t.Run("descending group order interleaves kinds", func(t *testing.T) {
		resp := search(t, "-group")
		require.Equal(t, []string{"whiskey", "xray", "yankee", "zulu"}, crossKindTitles(resp))
		require.Equal(t, []string{"recordingrule", "alertrule", "recordingrule", "alertrule"}, crossKindKinds(resp))
	})
}

func seedAlertRuleGroup(t *testing.T, client alerting.LegacyApiClient, group, title string) {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(groupSortFolder),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	rule := provisionedRule(base, title, group)
	createRuleGroup(t, client, group, rule)
}

func seedRecordingRuleGroup(t *testing.T, client alerting.LegacyApiClient, group, title, metric string) {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(groupSortFolder),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	rule := provisionedRule(base, title, group)
	rule.Record = &apimodels.Record{Metric: metric, From: "A", TargetDatasourceUID: base.Data[0].DatasourceUID}
	createRuleGroup(t, client, group, rule)
}

func provisionedRule(base ngmodels.AlertRule, title, group string) apimodels.ProvisionedAlertRule {
	return apimodels.ProvisionedAlertRule{
		UID:       base.UID,
		Title:     title,
		OrgID:     1,
		FolderUID: groupSortFolder,
		RuleGroup: group,
		Condition: "A",
		Data: []apimodels.AlertQuery{{
			RefID:             "A",
			DatasourceUID:     base.Data[0].DatasourceUID,
			Model:             base.Data[0].Model,
			RelativeTimeRange: apimodels.RelativeTimeRange{From: apimodels.Duration(5 * time.Minute), To: 0},
		}},
		NoDataState:  apimodels.NoData,
		ExecErrState: apimodels.ErrorErrState,
	}
}

func createRuleGroup(t *testing.T, client alerting.LegacyApiClient, group string, rule apimodels.ProvisionedAlertRule) {
	t.Helper()
	_, status, body := client.CreateOrUpdateRuleGroupProvisioning(t, apimodels.AlertRuleGroup{
		Title:     group,
		FolderUID: groupSortFolder,
		Interval:  10,
		Rules:     []apimodels.ProvisionedAlertRule{rule},
	})
	require.Equalf(t, 200, status, "seeding group %s: %s", group, body)
}

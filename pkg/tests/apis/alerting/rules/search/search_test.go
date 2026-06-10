package search

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

const searchFolder = "search-folder"

func TestIntegrationRuleSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Search reads through the provisioning service (the ngalert SQL store), so
	// results must be correct whichever dual-writer mode the rule resources run
	// in. Legacy is written (and authoritative) in modes 0-3.
	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode2, rest.Mode3} {
		t.Run(fmt.Sprintf("dualWriterMode=%d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"alertrules.rules.alerting.grafana.app":     {DualWriterMode: mode},
					"recordingrules.rules.alerting.grafana.app": {DualWriterMode: mode},
				},
			})
			runRuleSearchTests(t, helper)
		})
	}
}

func runRuleSearchTests(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	common.CreateTestFolder(t, helper, searchFolder)

	alertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)
	recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	createAlertRule(t, ctx, alertClient, "cpu usage high", false, map[string]string{"team": "a"}, "ds-prom")
	createAlertRule(t, ctx, alertClient, "memory usage high", true, map[string]string{"team": "b"}, "ds-loki")
	createAlertRule(t, ctx, alertClient, "disk low", false, map[string]string{"team": "a"}, "ds-prom")
	createRecordingRule(t, ctx, recClient, "cpu recording", "ds-prom")

	rc := helper.Org1.Admin.RESTClient(t, &v0alpha1.GroupVersion)
	getRaw := func(t *testing.T, path string, params url.Values) []byte {
		t.Helper()
		segments := []string{"apis", v0alpha1.APIGroup, v0alpha1.APIVersion, "namespaces", "default", "search"}
		if path != "" {
			segments = append(segments, path)
		}
		req := rc.Get().AbsPath(segments...)
		for k, vals := range params {
			for _, v := range vals {
				req = req.Param(k, v)
			}
		}
		raw, err := req.DoRaw(ctx)
		require.NoError(t, err)
		return raw
	}
	searchAlert := func(t *testing.T, params url.Values) v0alpha1.GetSearchAlertRulesResponse {
		var resp v0alpha1.GetSearchAlertRulesResponse
		require.NoError(t, json.Unmarshal(getRaw(t, "alertrules", params), &resp))
		return resp
	}
	searchRecording := func(t *testing.T, params url.Values) v0alpha1.GetSearchRecordingRulesResponse {
		var resp v0alpha1.GetSearchRecordingRulesResponse
		require.NoError(t, json.Unmarshal(getRaw(t, "recordingrules", params), &resp))
		return resp
	}
	searchCrossKind := func(t *testing.T, params url.Values) v0alpha1.GetSearchRulesResponse {
		var resp v0alpha1.GetSearchRulesResponse
		require.NoError(t, json.Unmarshal(getRaw(t, "", params), &resp))
		return resp
	}

	t.Run("alert rules: returns all alert rules", func(t *testing.T) {
		require.Len(t, searchAlert(t, nil).Items, 3)
	})

	t.Run("alert rules: compact-view fields populated", func(t *testing.T) {
		// interval is a config field common to both backends; assert it round
		// trips consistently regardless of storage mode.
		for _, h := range searchAlert(t, nil).Items {
			require.NotNil(t, h.Interval, h.Title)
			require.Equal(t, "10s", *h.Interval, h.Title)
		}
	})

	t.Run("alert rules: free-text title filter", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "memory usage high"}, alertTitles(searchAlert(t, url.Values{"q": {"usage"}})))
	})

	t.Run("alert rules: label matcher", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "disk low"}, alertTitles(searchAlert(t, url.Values{"labels": {"team=a"}})))
	})

	t.Run("alert rules: source datasource filter", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high"}, alertTitles(searchAlert(t, url.Values{"datasourceUIDs": {"ds-loki"}})))
	})

	t.Run("alert rules: paused filter", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high"}, alertTitles(searchAlert(t, url.Values{"paused": {"true"}})))
	})

	t.Run("alert rules: sort by title descending", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high", "disk low", "cpu usage high"}, alertTitles(searchAlert(t, url.Values{"sort": {"-title"}})))
	})

	t.Run("alert rules: pagination", func(t *testing.T) {
		first := searchAlert(t, url.Values{"sort": {"title"}, "limit": {"2"}})
		require.Equal(t, []string{"cpu usage high", "disk low"}, alertTitles(first))
		require.NotEmpty(t, first.Continue)

		second := searchAlert(t, url.Values{"sort": {"title"}, "limit": {"2"}, "continueToken": {first.Continue}})
		require.Equal(t, []string{"memory usage high"}, alertTitles(second))
		require.Empty(t, second.Continue)
	})

	t.Run("recording rules: returns all recording rules", func(t *testing.T) {
		resp := searchRecording(t, nil)
		require.Len(t, resp.Items, 1)
		require.Equal(t, "cpu recording", resp.Items[0].Title)
	})

	t.Run("cross-kind: returns both kinds", func(t *testing.T) {
		require.Len(t, searchCrossKind(t, nil).Items, 4)
	})

	t.Run("cross-kind: type narrowing", func(t *testing.T) {
		require.Equal(t, []string{"cpu recording"}, crossKindTitles(searchCrossKind(t, url.Values{"type": {"recordingrule"}})))
	})

	t.Run("consistency: search matches list", func(t *testing.T) {
		list, err := alertClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, searchAlert(t, nil).Items, len(list.Items))
	})
}

func alertTitles(resp v0alpha1.GetSearchAlertRulesResponse) []string {
	out := make([]string, 0, len(resp.Items))
	for _, h := range resp.Items {
		out = append(out, h.Title)
	}
	return out
}

// crossKindTitles reads the title from whichever variant of the union hit is set.
func crossKindTitles(resp v0alpha1.GetSearchRulesResponse) []string {
	out := make([]string, 0, len(resp.Items))
	for _, h := range resp.Items {
		switch {
		case h.AlertRuleHit != nil:
			out = append(out, h.AlertRuleHit.Title)
		case h.RecordingRuleHit != nil:
			out = append(out, h.RecordingRuleHit.Title)
		}
	}
	return out
}

func createAlertRule(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList], title string, paused bool, labels map[string]string, dsUID string) {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(searchFolder),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	rule := &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Name:        base.UID,
			Namespace:   "default",
			Annotations: map[string]string{v0alpha1.FolderAnnotationKey: searchFolder},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title:        title,
			Paused:       new(paused),
			Labels:       templateLabels(labels),
			Expressions:  alertExpressions(base, dsUID),
			Trigger:      v0alpha1.AlertRuleIntervalTrigger{Interval: "10s"},
			NoDataState:  "NoData",
			ExecErrState: "Error",
		},
	}
	_, err := client.Create(ctx, rule, v1.CreateOptions{})
	require.NoError(t, err)
}

func createRecordingRule(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.RecordingRule, v0alpha1.RecordingRuleList], title, dsUID string) {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(searchFolder),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	rule := &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Name:        base.UID,
			Namespace:   "default",
			Annotations: map[string]string{v0alpha1.FolderAnnotationKey: searchFolder},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:               title,
			Metric:              v0alpha1.RecordingRuleMetricName(base.Record.Metric),
			TargetDatasourceUID: v0alpha1.RecordingRuleDatasourceUID(dsUID),
			Expressions: v0alpha1.RecordingRuleExpressionMap{
				"A": {
					QueryType:     new(base.Data[0].QueryType),
					DatasourceUID: new(v0alpha1.RecordingRuleDatasourceUID(dsUID)),
					Model:         base.Data[0].Model,
					Source:        new(true),
					RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
						From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
						To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.RecordingRuleIntervalTrigger{Interval: "10s"},
		},
	}
	_, err := client.Create(ctx, rule, v1.CreateOptions{})
	require.NoError(t, err)
}

func alertExpressions(base ngmodels.AlertRule, dsUID string) v0alpha1.AlertRuleExpressionMap {
	return v0alpha1.AlertRuleExpressionMap{
		"A": {
			QueryType:     new(base.Data[0].QueryType),
			DatasourceUID: new(v0alpha1.AlertRuleDatasourceUID(dsUID)),
			Model:         base.Data[0].Model,
			Source:        new(true),
			RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
				From: v0alpha1.AlertRulePromDurationWMillis("5m"),
				To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
			},
		},
	}
}

func templateLabels(labels map[string]string) map[string]v0alpha1.AlertRuleTemplateString {
	if len(labels) == 0 {
		return nil
	}
	out := make(map[string]v0alpha1.AlertRuleTemplateString, len(labels))
	for k, v := range labels {
		out[k] = v0alpha1.AlertRuleTemplateString(v)
	}
	return out
}

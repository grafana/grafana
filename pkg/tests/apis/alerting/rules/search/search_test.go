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
	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode2} {
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
	do := func(t *testing.T, path string, params url.Values) searchResponse {
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
		var resp searchResponse
		require.NoError(t, json.Unmarshal(raw, &resp))
		return resp
	}
	search := func(t *testing.T, path string, params url.Values) []searchHit {
		return do(t, path, params).Items
	}

	t.Run("alert rules: returns all alert rules", func(t *testing.T) {
		hits := search(t, "alertrules", nil)
		require.Len(t, hits, 3)
	})

	t.Run("alert rules: free-text title filter", func(t *testing.T) {
		hits := search(t, "alertrules", url.Values{"q": {"usage"}})
		require.ElementsMatch(t, []string{"cpu usage high", "memory usage high"}, titles(hits))
	})

	t.Run("alert rules: label matcher", func(t *testing.T) {
		hits := search(t, "alertrules", url.Values{"labels": {"team=a"}})
		require.ElementsMatch(t, []string{"cpu usage high", "disk low"}, titles(hits))
	})

	t.Run("alert rules: source datasource filter", func(t *testing.T) {
		hits := search(t, "alertrules", url.Values{"datasourceUIDs": {"ds-loki"}})
		require.Equal(t, []string{"memory usage high"}, titles(hits))
	})

	t.Run("alert rules: paused filter", func(t *testing.T) {
		hits := search(t, "alertrules", url.Values{"paused": {"true"}})
		require.Equal(t, []string{"memory usage high"}, titles(hits))
	})

	t.Run("alert rules: sort by title descending", func(t *testing.T) {
		hits := search(t, "alertrules", url.Values{"sort": {"-title"}})
		require.Equal(t, []string{"memory usage high", "disk low", "cpu usage high"}, titles(hits))
	})

	t.Run("alert rules: pagination", func(t *testing.T) {
		first := do(t, "alertrules", url.Values{"sort": {"title"}, "limit": {"2"}})
		require.Len(t, first.Items, 2)
		require.Equal(t, []string{"cpu usage high", "disk low"}, titles(first.Items))
		require.NotEmpty(t, first.Metadata.Continue)

		second := do(t, "alertrules", url.Values{"sort": {"title"}, "limit": {"2"}, "continueToken": {first.Metadata.Continue}})
		require.Equal(t, []string{"memory usage high"}, titles(second.Items))
		require.Empty(t, second.Metadata.Continue)
	})

	t.Run("recording rules: returns all recording rules", func(t *testing.T) {
		hits := search(t, "recordingrules", nil)
		require.Equal(t, []string{"cpu recording"}, titles(hits))
	})

	t.Run("cross-kind: returns both kinds", func(t *testing.T) {
		hits := search(t, "", nil)
		require.Len(t, hits, 4)
	})

	t.Run("cross-kind: type narrowing", func(t *testing.T) {
		hits := search(t, "", url.Values{"type": {"recordingrule"}})
		require.Equal(t, []string{"cpu recording"}, titles(hits))
	})

	t.Run("consistency: search matches list", func(t *testing.T) {
		list, err := alertClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		hits := search(t, "alertrules", nil)
		require.Len(t, hits, len(list.Items))
	})
}

// searchHit / searchResponse decode the relevant parts of the generated
// response shape (metadata + spec) regardless of rule kind.
type searchHit struct {
	Metadata v1.ObjectMeta  `json:"metadata"`
	Spec     map[string]any `json:"spec"`
}

type searchResponse struct {
	Metadata v1.ListMeta `json:"metadata"`
	Items    []searchHit `json:"items"`
}

func titles(hits []searchHit) []string {
	out := make([]string, 0, len(hits))
	for _, h := range hits {
		if title, ok := h.Spec["title"].(string); ok {
			out = append(out, title)
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

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
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	facetFolderA = "facet-folder-a"
	facetFolderB = "facet-folder-b"
	facetFolderC = "facet-folder-c"
)

// TestIntegrationRuleSearchFacets verifies facet=folder returns per-folder rule
// counts: per-kind on the /search/alertrules and /search/recordingrules routes,
// and aggregated across both kinds on the cross-kind /search route. Counts must
// be independent of pagination, and consistent across dual-writer modes.
func TestIntegrationRuleSearchFacets(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode2, rest.Mode3} {
		t.Run(fmt.Sprintf("dualWriterMode=%d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"alertrules.rules.alerting.grafana.app":     {DualWriterMode: mode},
					"recordingrules.rules.alerting.grafana.app": {DualWriterMode: mode},
				},
			})
			runRuleSearchFacetTests(t, helper)
		})
	}
}

func runRuleSearchFacetTests(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	common.CreateTestFolder(t, helper, facetFolderA)
	common.CreateTestFolder(t, helper, facetFolderB)
	common.CreateTestFolder(t, helper, facetFolderC)

	alertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)
	recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	// folder-a: 2 alert rules; folder-b: 1 recording rule; folder-c: 1 of each.
	createAlertRuleInFolder(t, ctx, alertClient, facetFolderA, "a-alert-1", "ds-prom")
	createAlertRuleInFolder(t, ctx, alertClient, facetFolderA, "a-alert-2", "ds-prom")
	createRecordingRuleInFolder(t, ctx, recClient, facetFolderB, "b-rec-1", "ds-prom")
	createAlertRuleInFolder(t, ctx, alertClient, facetFolderC, "c-alert-1", "ds-prom")
	createRecordingRuleInFolder(t, ctx, recClient, facetFolderC, "c-rec-1", "ds-prom")

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

	// folderCounts reads the "folder" facet out of a raw response body, asserting
	// the facet is present, and returns folderUID -> count.
	folderCounts := func(t *testing.T, raw []byte) map[string]int64 {
		t.Helper()
		var body struct {
			Items  []json.RawMessage                             `json:"items"`
			Facets map[string]v0alpha1.GetSearchRulesFacetResult `json:"facets"`
		}
		require.NoError(t, json.Unmarshal(raw, &body))
		facet, ok := body.Facets["folder"]
		require.True(t, ok, "expected a folder facet in the response")
		counts := make(map[string]int64, len(facet.Terms))
		for _, term := range facet.Terms {
			counts[term.Term] = term.Count
		}
		return counts
	}

	facetOnly := url.Values{"facet": {"folder"}, "limit": {"0"}}

	t.Run("alert rules: per-folder counts", func(t *testing.T) {
		counts := folderCounts(t, getRaw(t, "alertrules", facetOnly))
		require.Equal(t, map[string]int64{facetFolderA: 2, facetFolderC: 1}, counts)
	})

	t.Run("recording rules: per-folder counts", func(t *testing.T) {
		counts := folderCounts(t, getRaw(t, "recordingrules", facetOnly))
		require.Equal(t, map[string]int64{facetFolderB: 1, facetFolderC: 1}, counts)
	})

	t.Run("cross-kind: counts aggregate alert and recording rules", func(t *testing.T) {
		counts := folderCounts(t, getRaw(t, "", facetOnly))
		require.Equal(t, map[string]int64{facetFolderA: 2, facetFolderB: 1, facetFolderC: 2}, counts)
	})

	t.Run("facet counts are independent of the row limit", func(t *testing.T) {
		// limit=0 returns no rows but full facets; limit=1 returns one row but the
		// same facet counts over the whole result set.
		full := folderCounts(t, getRaw(t, "", url.Values{"facet": {"folder"}, "limit": {"0"}}))
		paged := folderCounts(t, getRaw(t, "", url.Values{"facet": {"folder"}, "limit": {"1"}}))
		require.Equal(t, full, paged)
	})
}

func createAlertRuleInFolder(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList], folder, title, dsUID string) {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(folder),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	rule := &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Name:        base.UID,
			Namespace:   "default",
			Annotations: map[string]string{v0alpha1.FolderAnnotationKey: folder},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title:        title,
			Paused:       new(false),
			Expressions:  alertExpressions(base, dsUID),
			Trigger:      v0alpha1.AlertRuleIntervalTrigger{Interval: "10s"},
			NoDataState:  "NoData",
			ExecErrState: "Error",
		},
	}
	_, err := client.Create(ctx, rule, v1.CreateOptions{})
	require.NoError(t, err)
}

func createRecordingRuleInFolder(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.RecordingRule, v0alpha1.RecordingRuleList], folder, title, dsUID string) {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(folder),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	rule := &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Name:        base.UID,
			Namespace:   "default",
			Annotations: map[string]string{v0alpha1.FolderAnnotationKey: folder},
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

package search

import (
	"context"
	"encoding/json"
	"fmt"
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

const opIn = v0alpha1.CreateSearchRulesRequestSearchFilterLeafOperatorIn

// query is a small builder for a SearchQuery body used by the tests.
type query struct {
	body v0alpha1.CreateSearchRulesRequestBody
}

func newQuery() *query { return &query{} }

func (q *query) text(v string) *query {
	q.and(v0alpha1.CreateSearchRulesRequestSearchWhereNode{
		Text: &v0alpha1.CreateSearchRulesRequestSearchTextLeaf{Value: v},
	})
	return q
}

func (q *query) filter(field string, op v0alpha1.CreateSearchRulesRequestSearchFilterLeafOperator, values ...string) *query {
	q.and(v0alpha1.CreateSearchRulesRequestSearchWhereNode{
		Filter: &v0alpha1.CreateSearchRulesRequestSearchFilterLeaf{Field: field, Operator: op, Values: values},
	})
	return q
}

func (q *query) and(node v0alpha1.CreateSearchRulesRequestSearchWhereNode) {
	if q.body.Where == nil {
		q.body.Where = &v0alpha1.CreateSearchRulesRequestSearchWhereNode{}
	}
	q.body.Where.And = append(q.body.Where.And, node)
}

func (q *query) labelSelector(s string) *query { q.body.LabelSelector = &s; return q }
func (q *query) sort(fields ...string) *query {
	for _, f := range fields {
		q.body.Sort = append(q.body.Sort, v0alpha1.CreateSearchRulesRequestSearchSortField(f))
	}
	return q
}
func (q *query) limit(n int64) *query       { q.body.Limit = &n; return q }
func (q *query) continueAt(s string) *query { q.body.Continue = &s; return q }

func runRuleSearchTests(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	common.CreateTestFolder(t, helper, searchFolder)

	alertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)
	recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	createAlertRule(t, ctx, alertClient, "cpu usage high", false, map[string]string{"team": "a"}, "ds-prom")
	createAlertRule(t, ctx, alertClient, "memory usage high", true, map[string]string{"team": "b"}, "ds-loki")
	createAlertRule(t, ctx, alertClient, "disk low", false, map[string]string{"team": "a"}, "ds-prom")
	createRecordingRule(t, ctx, recClient, "cpu recording", "ds-prom")
	createRecordingRule(t, ctx, recClient, "disk recording", "ds-prom")

	rc := helper.Org1.Admin.RESTClient(t, &v0alpha1.GroupVersion)
	search := func(t *testing.T, q *query) v0alpha1.CreateSearchRulesResponse {
		t.Helper()
		var payload []byte
		if q != nil {
			var err error
			payload, err = json.Marshal(q.body)
			require.NoError(t, err)
		}
		raw, err := rc.Post().
			AbsPath("apis", v0alpha1.APIGroup, v0alpha1.APIVersion, "namespaces", "default", "search").
			Body(payload).
			DoRaw(ctx)
		require.NoError(t, err)
		var resp v0alpha1.CreateSearchRulesResponse
		require.NoError(t, json.Unmarshal(raw, &resp))
		return resp
	}
	// searchKind narrows to a single kind via a type filter leaf.
	searchKind := func(t *testing.T, kind string, q *query) v0alpha1.CreateSearchRulesResponse {
		if q == nil {
			q = newQuery()
		}
		return search(t, q.filter("type", opIn, kind))
	}

	t.Run("alert rules: returns all alert rules", func(t *testing.T) {
		require.Len(t, searchKind(t, "alertrule", nil).Items, 3)
	})

	t.Run("alert rules: compact-view fields populated", func(t *testing.T) {
		// interval is a config field common to both backends; assert it round
		// trips consistently regardless of storage mode.
		for _, h := range searchKind(t, "alertrule", nil).Items {
			require.NotNil(t, h.Fields.Interval, title(h))
			require.Equal(t, "10s", *h.Fields.Interval, title(h))
		}
	})

	t.Run("alert rules: filter by name (uid)", func(t *testing.T) {
		all := searchKind(t, "alertrule", nil).Items
		require.GreaterOrEqual(t, len(all), 2)
		want := []string{all[0].Resource.Name, all[1].Resource.Name}
		got := searchKind(t, "alertrule", newQuery().filter("name", opIn, want...))
		gotNames := make([]string, 0, len(got.Items))
		for _, h := range got.Items {
			gotNames = append(gotNames, h.Resource.Name)
		}
		require.ElementsMatch(t, want, gotNames)
	})

	t.Run("alert rules: free-text title filter", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "memory usage high"}, titles(searchKind(t, "alertrule", newQuery().text("usage"))))
	})

	t.Run("alert rules: label matcher", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "disk low"}, titles(searchKind(t, "alertrule", newQuery().labelSelector("team=a"))))
	})

	t.Run("alert rules: source datasource filter", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high"}, titles(searchKind(t, "alertrule", newQuery().filter("datasourceUIDs", opIn, "ds-loki"))))
	})

	t.Run("alert rules: paused filter", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high"}, titles(searchKind(t, "alertrule", newQuery().filter("paused", opIn, "true"))))
	})

	t.Run("alert rules: sort by title descending", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high", "disk low", "cpu usage high"}, titles(searchKind(t, "alertrule", newQuery().sort("-title"))))
	})

	t.Run("alert rules: pagination", func(t *testing.T) {
		first := searchKind(t, "alertrule", newQuery().sort("title").limit(2))
		require.Equal(t, []string{"cpu usage high", "disk low"}, titles(first))
		require.NotNil(t, first.Metadata.Continue)
		require.NotEmpty(t, *first.Metadata.Continue)

		second := searchKind(t, "alertrule", newQuery().sort("title").limit(2).continueAt(*first.Metadata.Continue))
		require.Equal(t, []string{"memory usage high"}, titles(second))
		require.Nil(t, second.Metadata.Continue)
	})

	t.Run("recording rules: returns all recording rules", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu recording", "disk recording"}, titles(searchKind(t, "recordingrule", nil)))
	})

	t.Run("cross-kind: returns both kinds", func(t *testing.T) {
		require.Len(t, search(t, nil).Items, 5)
	})

	t.Run("cross-kind: type narrowing", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu recording", "disk recording"}, titles(searchKind(t, "recordingrule", nil)))
	})

	t.Run("cross-kind: interleaved by title", func(t *testing.T) {
		// Sorting the union by title mixes the two kinds rather than grouping
		// them: the recordings land between alert rules.
		asc := search(t, newQuery().sort("title"))
		require.Equal(t, []string{"cpu recording", "cpu usage high", "disk low", "disk recording", "memory usage high"}, titles(asc))
		require.Equal(t, []string{"recordingrule", "alertrule", "alertrule", "recordingrule", "alertrule"}, kinds(asc))

		desc := search(t, newQuery().sort("-title"))
		require.Equal(t, []string{"memory usage high", "disk recording", "disk low", "cpu usage high", "cpu recording"}, titles(desc))
		require.Equal(t, []string{"alertrule", "recordingrule", "alertrule", "alertrule", "recordingrule"}, kinds(desc))
	})

	t.Run("consistency: search matches list", func(t *testing.T) {
		list, err := alertClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, searchKind(t, "alertrule", nil).Items, len(list.Items))
	})
}

func title(h v0alpha1.CreateSearchRulesSearchResultHit) string {
	if h.Fields.Title == nil {
		return ""
	}
	return *h.Fields.Title
}

func titles(resp v0alpha1.CreateSearchRulesResponse) []string {
	out := make([]string, 0, len(resp.Items))
	for _, h := range resp.Items {
		out = append(out, title(h))
	}
	return out
}

// kinds reports the "type" field of each hit, in order, so a test can assert the
// two kinds are interleaved rather than grouped.
func kinds(resp v0alpha1.CreateSearchRulesResponse) []string {
	out := make([]string, 0, len(resp.Items))
	for _, h := range resp.Items {
		if h.Fields.Type != nil {
			out = append(out, *h.Fields.Type)
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

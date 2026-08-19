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
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
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

// The resource segments the two search endpoints are mounted under. They are the
// resource names, because the routes sit where the generic search API mounts:
// .../namespaces/{ns}/{resource}/search.
const (
	alertRules     = "alertrules"
	recordingRules = "recordingrules"
)

const opIn = "In"

func TestIntegrationRuleSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Search reads through the provisioning service (the ngalert SQL store) in
	// modes 0-3, where legacy is authoritative, and from unified storage in mode
	// 4, so every case below has to hold on both backends.
	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode2, rest.Mode3, rest.Mode4} {
		t.Run(fmt.Sprintf("dualWriterMode=%d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"alertrules.rules.alerting.grafana.app":     {DualWriterMode: mode},
					"recordingrules.rules.alerting.grafana.app": {DualWriterMode: mode},
				},
			})
			runRuleSearchTests(t, helper, mode)
		})
	}
}

// query is a small builder for a SearchQuery body used by the tests. It starts
// from a valid envelope, since the endpoint requires one.
type query struct {
	body searchv0.SearchQuery
}

func newQuery() *query {
	return &query{body: searchv0.SearchQuery{
		TypeMeta: v1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
	}}
}

func (q *query) text(v string) *query {
	q.and(searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: v}})
	return q
}

func (q *query) filter(field, op string, values ...string) *query {
	q.and(searchv0.WhereNode{
		Filter: &searchv0.FilterPredicate{Field: field, Operator: op, Values: values},
	})
	return q
}

func (q *query) and(node searchv0.WhereNode) {
	if q.body.Where == nil {
		q.body.Where = &searchv0.WhereNode{}
	}
	q.body.Where.And = append(q.body.Where.And, node)
}

func (q *query) labelSelector(sel *v1.LabelSelector) *query {
	q.body.LabelSelector = sel
	return q
}

func (q *query) sort(field, direction string) *query {
	q.body.Sort = append(q.body.Sort, searchv0.SortField{Field: field, Direction: direction})
	return q
}

func (q *query) fields(names ...string) *query { q.body.Fields = names; return q }
func (q *query) limit(n int64) *query          { q.body.Limit = n; return q }
func (q *query) continueAt(s string) *query    { q.body.Continue = s; return q }

func runRuleSearchTests(t *testing.T, helper *apis.K8sTestHelper, mode rest.DualWriterMode) {
	ctx := context.Background()
	common.CreateTestFolder(t, helper, searchFolder)

	alertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)
	recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	createAlertRule(t, ctx, alertClient, "cpu usage high", false, map[string]string{"team": "a"}, "ds-prom", 1234)
	createAlertRule(t, ctx, alertClient, "memory usage high", true, map[string]string{"team": "b"}, "ds-loki", 4321)
	createAlertRule(t, ctx, alertClient, "disk low", false, map[string]string{"team": "a"}, "ds-prom", 1000)
	createRecordingRule(t, ctx, recClient, "cpu recording", "ds-prom", "cpu_seconds_total")
	createRecordingRule(t, ctx, recClient, "disk recording", "ds-prom", "disk_bytes_total")

	rc := helper.Org1.Admin.RESTClient(t, &v0alpha1.GroupVersion)
	// search posts to one kind's endpoint. There is no cross-kind search: the
	// kind is the path, so searching both means two calls.
	search := func(t *testing.T, resourceName string, q *query) searchv0.SearchResults {
		t.Helper()
		if q == nil {
			q = newQuery()
		}
		payload, err := json.Marshal(q.body)
		require.NoError(t, err)

		raw, err := rc.Post().
			AbsPath("apis", v0alpha1.APIGroup, v0alpha1.APIVersion, "namespaces", "default", resourceName, "search").
			Body(payload).
			DoRaw(ctx)
		require.NoError(t, err)

		var resp searchv0.SearchResults
		require.NoError(t, json.Unmarshal(raw, &resp))
		return resp
	}
	searchAlerts := func(t *testing.T, q *query) searchv0.SearchResults {
		t.Helper()
		return search(t, alertRules, q)
	}

	// The envelope identifies the generic search contract, not the alerting group
	// that happens to serve it: that is what lets the generic endpoint take these
	// routes over without a client change.
	t.Run("response carries the generic search envelope", func(t *testing.T) {
		resp := searchAlerts(t, nil)
		require.Equal(t, searchv0.APIVERSION, resp.APIVersion)
		require.Equal(t, searchv0.KindSearchResults, resp.Kind)
	})

	t.Run("alert rules: returns all alert rules", func(t *testing.T) {
		resp := searchAlerts(t, nil)
		require.Len(t, resp.Items, 3)
		require.EqualValues(t, 3, resp.Metadata.TotalHits)
		for _, h := range resp.Items {
			require.Equal(t, "AlertRule", h.Resource.Kind)
			require.Equal(t, alertRules, h.Resource.Resource)
			require.Equal(t, v0alpha1.APIGroup, h.Resource.Group)
		}
	})

	t.Run("recording rules: returns all recording rules", func(t *testing.T) {
		resp := search(t, recordingRules, nil)
		require.ElementsMatch(t, []string{"cpu recording", "disk recording"}, titles(resp))
		for _, h := range resp.Items {
			require.Equal(t, "RecordingRule", h.Resource.Kind)
			require.Equal(t, recordingRules, h.Resource.Resource)
		}
	})

	// Each endpoint sees only its own kind, so no alert rule can surface on the
	// recording rule endpoint or the other way round.
	t.Run("each endpoint returns only its own kind", func(t *testing.T) {
		require.NotContains(t, titles(searchAlerts(t, nil)), "cpu recording")
		require.NotContains(t, titles(search(t, recordingRules, nil)), "cpu usage high")
	})

	// A hit carries title and folder unless the query asks for more, matching the
	// generic contract's default projection.
	t.Run("projection defaults to title and folder", func(t *testing.T) {
		for _, h := range searchAlerts(t, nil).Items {
			require.NotNil(t, h.Fields)
			require.ElementsMatch(t, []string{"title", "folder"}, fieldNames(h))
			require.Equal(t, searchFolder, stringField(t, h, "folder"))
		}
	})

	t.Run("projection returns the requested fields", func(t *testing.T) {
		// interval is a config field common to both backends; assert it round
		// trips consistently regardless of storage mode.
		for _, h := range searchAlerts(t, newQuery().fields("title", "interval")).Items {
			require.ElementsMatch(t, []string{"title", "interval"}, fieldNames(h), title(h))
			require.Equal(t, "10s", stringField(t, h, "interval"), title(h))
		}
	})

	t.Run("alert rules: filter by name (uid)", func(t *testing.T) {
		all := searchAlerts(t, nil).Items
		require.GreaterOrEqual(t, len(all), 2)
		want := []string{all[0].Resource.Name, all[1].Resource.Name}
		got := searchAlerts(t, newQuery().filter("name", opIn, want...))
		gotNames := make([]string, 0, len(got.Items))
		for _, h := range got.Items {
			gotNames = append(gotNames, h.Resource.Name)
		}
		require.ElementsMatch(t, want, gotNames)
	})

	t.Run("alert rules: free-text title filter", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "memory usage high"}, titles(searchAlerts(t, newQuery().text("usage"))))
	})

	// A text leaf searches the title and only the title: the handler rejects a
	// per-field text leaf naming anything else, legacy pushes it into a LIKE on
	// the title column, and unified defaults its query fields to title. Every term
	// must appear, in any order, which a single-word query cannot show, so pin
	// both axes explicitly.
	t.Run("alert rules: title text spans non-adjacent words", func(t *testing.T) {
		require.Equal(t, []string{"cpu usage high"}, titles(searchAlerts(t, newQuery().text("cpu high"))))
	})

	t.Run("alert rules: title text is order-insensitive", func(t *testing.T) {
		require.Equal(t, []string{"cpu usage high"}, titles(searchAlerts(t, newQuery().text("high cpu"))))
	})

	t.Run("alert rules: title text ignores short terms when a searchable term remains", func(t *testing.T) {
		require.Equal(t, []string{"cpu usage high"}, titles(searchAlerts(t, newQuery().text("cpu xy"))))
	})

	t.Run("alert rules: title text requires every term to match", func(t *testing.T) {
		require.Empty(t, titles(searchAlerts(t, newQuery().text("cpu nonexistent"))))
	})

	t.Run("alert rules: title text is case-insensitive", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "memory usage high"}, titles(searchAlerts(t, newQuery().text("USAGE"))))
	})

	t.Run("alert rules: title text matches nothing when no title contains it", func(t *testing.T) {
		require.Empty(t, titles(searchAlerts(t, newQuery().text("nonexistent"))))
	})

	// Rule spec labels are filtered through a labels filter leaf. The separate
	// labelSelector selects on resource metadata labels, not these.
	t.Run("alert rules: label matcher", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "disk low"}, titles(searchAlerts(t, newQuery().filter("labels", opIn, "team=a"))))
	})

	// labelSelector targets metadata labels. Selecting a group that no rule is in
	// must return nothing: were the selector dropped, every rule would match.
	t.Run("alert rules: metadata labelSelector is applied", func(t *testing.T) {
		got := searchAlerts(t, newQuery().labelSelector(&v1.LabelSelector{
			MatchLabels: map[string]string{v0alpha1.GroupLabelKey: "no-such-group"},
		}))
		require.Empty(t, got.Items)
	})

	t.Run("alert rules: source datasource filter", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high"}, titles(searchAlerts(t, newQuery().filter("datasourceUIDs", opIn, "ds-loki"))))
	})

	t.Run("alert rules: paused filter", func(t *testing.T) {
		// TODO: unskip this once filtering on non-string fields in Unified Search is fixed
		if mode == rest.Mode4 {
			t.Skip()
		}
		require.Equal(t, []string{"memory usage high"}, titles(searchAlerts(t, newQuery().filter("paused", opIn, "true"))))
	})

	t.Run("alert rules: panelID filter", func(t *testing.T) {
		// TODO: unskip this once filtering on non-string fields in Unified Search is fixed
		if mode == rest.Mode4 {
			t.Skip()
		}
		require.Equal(t, []string{"cpu usage high"}, titles(searchAlerts(t, newQuery().filter("panelID", opIn, "1234"))))
	})

	// The endpoint already fixes the kind, so a type filter can only agree or
	// disagree with it. Agreeing changes nothing; disagreeing can match nothing,
	// and both backends have to say so rather than return the whole kind.
	t.Run("type filter is redundant with the endpoint's kind", func(t *testing.T) {
		require.Len(t, searchAlerts(t, newQuery().filter("type", opIn, "alertrule")).Items, 3)

		contradicted := searchAlerts(t, newQuery().filter("type", opIn, "recordingrule"))
		require.Empty(t, contradicted.Items)
		require.Zero(t, contradicted.Metadata.TotalHits)
	})

	t.Run("alert rules: sort by title descending", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high", "disk low", "cpu usage high"},
			titles(searchAlerts(t, newQuery().sort("title", "desc"))))
	})

	t.Run("alert rules: pagination", func(t *testing.T) {
		first := searchAlerts(t, newQuery().sort("title", "asc").limit(2))
		require.Equal(t, []string{"cpu usage high", "disk low"}, titles(first))
		require.NotEmpty(t, first.Metadata.Continue)

		second := searchAlerts(t, newQuery().sort("title", "asc").limit(2).continueAt(first.Metadata.Continue))
		require.Equal(t, []string{"memory usage high"}, titles(second))
		require.Empty(t, second.Metadata.Continue)
	})

	t.Run("kind-specific fields", func(t *testing.T) {
		t.Run("alert rules carry their own", func(t *testing.T) {
			h := hitFor(t, searchAlerts(t, newQuery().fields("title", "type", "dashboardUID", "panelID")), "cpu usage high")
			require.Equal(t, "alertrule", stringField(t, h, "type"))
			require.Equal(t, "foo", stringField(t, h, "dashboardUID"))
			require.EqualValues(t, 1234, numberField(t, h, "panelID"))
		})

		t.Run("recording rules carry their own", func(t *testing.T) {
			resp := search(t, recordingRules, newQuery().fields("title", "type", "metric", "targetDatasourceUID"))
			h := hitFor(t, resp, "cpu recording")
			require.Equal(t, "recordingrule", stringField(t, h, "type"))
			require.Equal(t, "cpu_seconds_total", stringField(t, h, "metric"))
			require.Equal(t, "ds-prom", stringField(t, h, "targetDatasourceUID"))
		})
	})

	// A field the other kind declares is not part of this kind's contract, so
	// naming it is a rejected query rather than one that answers with nothing.
	t.Run("rejects a query naming another kind's field", func(t *testing.T) {
		payload, err := json.Marshal(newQuery().fields("metric").body)
		require.NoError(t, err)
		_, err = rc.Post().
			AbsPath("apis", v0alpha1.APIGroup, v0alpha1.APIVersion, "namespaces", "default", alertRules, "search").
			Body(payload).
			DoRaw(ctx)
		require.Error(t, err)
	})

	t.Run("default title order is case-insensitive", func(t *testing.T) {
		createAlertRule(t, ctx, alertClient, "zebra case", false, nil, "ds-prom", 2000)
		createAlertRule(t, ctx, alertClient, "Apple case", false, nil, "ds-prom", 2001)
		require.Equal(t, []string{"Apple case", "zebra case"},
			titles(searchAlerts(t, newQuery().text("case"))))
	})

	t.Run("consistency: search matches list", func(t *testing.T) {
		list, err := alertClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, searchAlerts(t, nil).Items, len(list.Items))
	})
}

// Field readers. A hit's fields are an open JSON object, because that is what the
// generic endpoint returns; the tests read through it by name.

func fieldValues(h searchv0.ResultItem) map[string]any {
	if h.Fields == nil {
		return nil
	}
	return h.Fields.Object
}

func fieldNames(h searchv0.ResultItem) []string {
	values := fieldValues(h)
	out := make([]string, 0, len(values))
	for name := range values {
		out = append(out, name)
	}
	return out
}

func stringField(t *testing.T, h searchv0.ResultItem, name string) string {
	t.Helper()
	v, ok := fieldValues(h)[name]
	require.True(t, ok, "hit is missing field %q", name)
	s, ok := v.(string)
	require.True(t, ok, "field %q is %T, not a string", name, v)
	return s
}

func numberField(t *testing.T, h searchv0.ResultItem, name string) float64 {
	t.Helper()
	v, ok := fieldValues(h)[name]
	require.True(t, ok, "hit is missing field %q", name)
	n, ok := v.(float64)
	require.True(t, ok, "field %q is %T, not a number", name, v)
	return n
}

func title(h searchv0.ResultItem) string {
	s, _ := fieldValues(h)["title"].(string)
	return s
}

func titles(resp searchv0.SearchResults) []string {
	out := make([]string, 0, len(resp.Items))
	for _, h := range resp.Items {
		out = append(out, title(h))
	}
	return out
}

func hitFor(t *testing.T, resp searchv0.SearchResults, want string) searchv0.ResultItem {
	t.Helper()
	for _, h := range resp.Items {
		if title(h) == want {
			return h
		}
	}
	require.FailNowf(t, "hit not found", "no hit titled %q in %v", want, titles(resp))
	return searchv0.ResultItem{}
}

func createAlertRule(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList], title string, paused bool, labels map[string]string, dsUID string, panelID int64) {
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
			PanelRef: &v0alpha1.AlertRulePanelRef{
				DashboardUID: "foo",
				PanelID:      panelID,
			},
		},
	}
	_, err := client.Create(ctx, rule, v1.CreateOptions{})
	require.NoError(t, err)
}

func createRecordingRule(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.RecordingRule, v0alpha1.RecordingRuleList], title, dsUID, metric string) {
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
			Metric:              v0alpha1.RecordingRuleMetricName(metric),
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

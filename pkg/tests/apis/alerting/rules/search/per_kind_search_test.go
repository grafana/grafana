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
	"github.com/grafana/grafana/pkg/util/testutil"
)

const perKindSearchFolder = "search-folder"

// The resource segments the two search endpoints are mounted under.
const (
	alertRules     = "alertrules"
	recordingRules = "recordingrules"
)

const perKindOpIn = "In"

func TestIntegrationPerKindRuleSearch(t *testing.T) {
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
			runPerKindRuleSearchTests(t, helper, mode)
		})
	}
}

// kindQuery is a small builder for a SearchQuery body used by the tests. It starts
// from a valid envelope, since the endpoint requires one.
type perKindQuery struct {
	body searchv0.SearchQuery
}

func newPerKindQuery() *perKindQuery {
	return &perKindQuery{body: searchv0.SearchQuery{
		TypeMeta: v1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
	}}
}

func (q *perKindQuery) text(v string) *perKindQuery {
	q.and(searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: v}})
	return q
}

func (q *perKindQuery) filter(field, op string, values ...string) *perKindQuery {
	q.and(searchv0.WhereNode{
		Filter: &searchv0.FilterPredicate{Field: field, Operator: op, Values: values},
	})
	return q
}

func (q *perKindQuery) and(node searchv0.WhereNode) {
	if q.body.Where == nil {
		q.body.Where = &searchv0.WhereNode{}
	}
	q.body.Where.And = append(q.body.Where.And, node)
}

func (q *perKindQuery) labelSelector(sel *v1.LabelSelector) *perKindQuery {
	q.body.LabelSelector = sel
	return q
}

func (q *perKindQuery) sort(field, direction string) *perKindQuery {
	q.body.Sort = append(q.body.Sort, searchv0.SortField{Field: field, Direction: direction})
	return q
}

func (q *perKindQuery) fields(names ...string) *perKindQuery { q.body.Fields = names; return q }
func (q *perKindQuery) limit(n int64) *perKindQuery          { q.body.Limit = n; return q }
func (q *perKindQuery) continueAt(s string) *perKindQuery    { q.body.Continue = s; return q }

func runPerKindRuleSearchTests(t *testing.T, helper *apis.K8sTestHelper, mode rest.DualWriterMode) {
	ctx := context.Background()
	common.CreateTestFolder(t, helper, perKindSearchFolder)

	alertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)
	recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	createPerKindAlertRule(t, ctx, alertClient, "cpu usage high", false, map[string]string{"team": "a"}, "ds-prom", 1234)
	createPerKindAlertRule(t, ctx, alertClient, "memory usage high", true, map[string]string{"team": "b"}, "ds-loki", 4321)
	createPerKindAlertRule(t, ctx, alertClient, "disk low", false, map[string]string{"team": "a"}, "ds-prom", 1000)
	createPerKindRecordingRule(t, ctx, recClient, "cpu recording", "ds-prom", "cpu_seconds_total")
	createPerKindRecordingRule(t, ctx, recClient, "disk recording", "ds-prom", "disk_bytes_total")

	rc := helper.Org1.Admin.RESTClient(t, &v0alpha1.GroupVersion)
	viewerRC := helper.Org1.Viewer.RESTClient(t, &v0alpha1.GroupVersion)
	// search posts to one kind's endpoint. There is no cross-kind search: the
	// kind is the path, so searching both means two calls.
	search := func(t *testing.T, resourceName string, q *perKindQuery) searchv0.SearchResults {
		t.Helper()
		if q == nil {
			q = newPerKindQuery()
		}
		payload, err := json.Marshal(q.body)
		require.NoError(t, err)

		raw, err := rc.Post().
			AbsPath("apis", v0alpha1.APIGroup, v0alpha1.APIVersion, "namespaces", "default", resourceName, "searchRules").
			Body(payload).
			DoRaw(ctx)
		require.NoError(t, err)

		var resp searchv0.SearchResults
		require.NoError(t, json.Unmarshal(raw, &resp))
		return resp
	}
	searchAlerts := func(t *testing.T, q *perKindQuery) searchv0.SearchResults {
		t.Helper()
		return search(t, alertRules, q)
	}

	t.Run("viewer may search without rule-create permission", func(t *testing.T) {
		payload, err := json.Marshal(newPerKindQuery().body)
		require.NoError(t, err)

		for _, resourceName := range []string{alertRules, recordingRules} {
			raw, err := viewerRC.Post().
				AbsPath("apis", v0alpha1.APIGroup, v0alpha1.APIVersion, "namespaces", "default", resourceName, "searchRules").
				Body(payload).
				DoRaw(ctx)
			require.NoError(t, err, resourceName)

			var resp searchv0.SearchResults
			require.NoError(t, json.Unmarshal(raw, &resp), resourceName)
			require.Equal(t, searchv0.APIVERSION, resp.APIVersion, resourceName)
			require.Equal(t, searchv0.KindSearchResults, resp.Kind, resourceName)
		}
	})

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
		require.ElementsMatch(t, []string{"cpu recording", "disk recording"}, perKindTitles(resp))
		for _, h := range resp.Items {
			require.Equal(t, "RecordingRule", h.Resource.Kind)
			require.Equal(t, recordingRules, h.Resource.Resource)
		}
	})

	// Each endpoint sees only its own kind, so no alert rule can surface on the
	// recording rule endpoint or the other way round.
	t.Run("each endpoint returns only its own kind", func(t *testing.T) {
		require.NotContains(t, perKindTitles(searchAlerts(t, nil)), "cpu recording")
		require.NotContains(t, perKindTitles(search(t, recordingRules, nil)), "cpu usage high")
	})

	// A hit carries kindTitle and folder unless the kindQuery asks for more, matching the
	// generic contract's default projection.
	t.Run("projection defaults to perKindTitle and folder", func(t *testing.T) {
		for _, h := range searchAlerts(t, nil).Items {
			require.NotNil(t, h.Fields)
			require.ElementsMatch(t, []string{"title", "folder"}, perKindFieldNames(h))
			require.Equal(t, perKindSearchFolder, perKindStringField(t, h, "folder"))
		}
	})

	t.Run("projection returns the requested fields", func(t *testing.T) {
		// interval is a config field common to both backends; assert it round
		// trips consistently regardless of storage mode.
		for _, h := range searchAlerts(t, newPerKindQuery().fields("title", "interval")).Items {
			require.ElementsMatch(t, []string{"title", "interval"}, perKindFieldNames(h), perKindTitle(h))
			require.Equal(t, "10s", perKindStringField(t, h, "interval"), perKindTitle(h))
		}
	})

	t.Run("alert rules: filter by name (uid)", func(t *testing.T) {
		all := searchAlerts(t, nil).Items
		require.GreaterOrEqual(t, len(all), 2)
		want := []string{all[0].Resource.Name, all[1].Resource.Name}
		got := searchAlerts(t, newPerKindQuery().filter("name", perKindOpIn, want...))
		gotNames := make([]string, 0, len(got.Items))
		for _, h := range got.Items {
			gotNames = append(gotNames, h.Resource.Name)
		}
		require.ElementsMatch(t, want, gotNames)
	})

	t.Run("alert rules: free-text perKindTitle filter", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "memory usage high"}, perKindTitles(searchAlerts(t, newPerKindQuery().text("usage"))))
	})

	// A text leaf searches the kindTitle and only the kindTitle: the handler rejects a
	// per-field text leaf naming anything else, legacy pushes it into a LIKE on
	// the kindTitle column, and unified defaults its kindQuery fields to kindTitle. Every term
	// must appear, in any order, which a single-word kindQuery cannot show, so pin
	// both axes explicitly.
	t.Run("alert rules: perKindTitle text spans non-adjacent words", func(t *testing.T) {
		require.Equal(t, []string{"cpu usage high"}, perKindTitles(searchAlerts(t, newPerKindQuery().text("cpu high"))))
	})

	t.Run("alert rules: perKindTitle text is order-insensitive", func(t *testing.T) {
		require.Equal(t, []string{"cpu usage high"}, perKindTitles(searchAlerts(t, newPerKindQuery().text("high cpu"))))
	})

	t.Run("alert rules: perKindTitle text ignores short terms when a searchable term remains", func(t *testing.T) {
		require.Equal(t, []string{"cpu usage high"}, perKindTitles(searchAlerts(t, newPerKindQuery().text("cpu xy"))))
	})

	t.Run("alert rules: perKindTitle text requires every term to match", func(t *testing.T) {
		require.Empty(t, perKindTitles(searchAlerts(t, newPerKindQuery().text("cpu nonexistent"))))
	})

	t.Run("alert rules: perKindTitle text is case-insensitive", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "memory usage high"}, perKindTitles(searchAlerts(t, newPerKindQuery().text("USAGE"))))
	})

	t.Run("alert rules: perKindTitle text matches nothing when no perKindTitle contains it", func(t *testing.T) {
		require.Empty(t, perKindTitles(searchAlerts(t, newPerKindQuery().text("nonexistent"))))
	})

	// Rule spec labels are filtered through a labels filter leaf. The separate
	// labelSelector selects on resource metadata labels, not these.
	t.Run("alert rules: label matcher", func(t *testing.T) {
		require.ElementsMatch(t, []string{"cpu usage high", "disk low"}, perKindTitles(searchAlerts(t, newPerKindQuery().filter("labels", perKindOpIn, "team=a"))))
	})

	// labelSelector targets metadata labels. Selecting a group that no rule is in
	// must return nothing: were the selector dropped, every rule would match.
	t.Run("alert rules: metadata labelSelector is applied", func(t *testing.T) {
		got := searchAlerts(t, newPerKindQuery().labelSelector(&v1.LabelSelector{
			MatchLabels: map[string]string{v0alpha1.GroupLabelKey: "no-such-group"},
		}))
		require.Empty(t, got.Items)
	})

	t.Run("alert rules: source datasource filter", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high"}, perKindTitles(searchAlerts(t, newPerKindQuery().filter("datasourceUIDs", perKindOpIn, "ds-loki"))))
	})

	t.Run("alert rules: paused filter", func(t *testing.T) {
		// TODO: unskip this once filtering on non-string fields in Unified Search is fixed
		if mode == rest.Mode4 {
			t.Skip()
		}
		require.Equal(t, []string{"memory usage high"}, perKindTitles(searchAlerts(t, newPerKindQuery().filter("paused", perKindOpIn, "true"))))
	})

	t.Run("alert rules: panelID filter", func(t *testing.T) {
		// TODO: unskip this once filtering on non-string fields in Unified Search is fixed
		if mode == rest.Mode4 {
			t.Skip()
		}
		require.Equal(t, []string{"cpu usage high"}, perKindTitles(searchAlerts(t, newPerKindQuery().filter("panelID", perKindOpIn, "1234"))))
	})

	// The endpoint already fixes the kind, so a type filter can only agree or
	// disagree with it. Agreeing changes nothing; disagreeing can match nothing,
	// and both backends have to say so rather than return the whole kind.
	t.Run("type filter is redundant with the endpoint's kind", func(t *testing.T) {
		require.Len(t, searchAlerts(t, newPerKindQuery().filter("type", perKindOpIn, "alertrule")).Items, 3)

		contradicted := searchAlerts(t, newPerKindQuery().filter("type", perKindOpIn, "recordingrule"))
		require.Empty(t, contradicted.Items)
		require.Zero(t, contradicted.Metadata.TotalHits)
	})

	t.Run("alert rules: sort by perKindTitle descending", func(t *testing.T) {
		require.Equal(t, []string{"memory usage high", "disk low", "cpu usage high"},
			perKindTitles(searchAlerts(t, newPerKindQuery().sort("title", "desc"))))
	})

	t.Run("alert rules: pagination", func(t *testing.T) {
		first := searchAlerts(t, newPerKindQuery().sort("title", "asc").limit(2))
		require.Equal(t, []string{"cpu usage high", "disk low"}, perKindTitles(first))
		require.NotEmpty(t, first.Metadata.Continue)

		second := searchAlerts(t, newPerKindQuery().sort("title", "asc").limit(2).continueAt(first.Metadata.Continue))
		require.Equal(t, []string{"memory usage high"}, perKindTitles(second))
		require.Empty(t, second.Metadata.Continue)
	})

	t.Run("kind-specific fields", func(t *testing.T) {
		t.Run("alert rules carry their own", func(t *testing.T) {
			h := perKindHitFor(t, searchAlerts(t, newPerKindQuery().fields("title", "type", "dashboardUID", "panelID")), "cpu usage high")
			require.Equal(t, "alertrule", perKindStringField(t, h, "type"))
			require.Equal(t, "foo", perKindStringField(t, h, "dashboardUID"))
			require.EqualValues(t, 1234, perKindNumberField(t, h, "panelID"))
		})

		t.Run("recording rules carry their own", func(t *testing.T) {
			resp := search(t, recordingRules, newPerKindQuery().fields("title", "type", "metric", "targetDatasourceUID"))
			h := perKindHitFor(t, resp, "cpu recording")
			require.Equal(t, "recordingrule", perKindStringField(t, h, "type"))
			require.Equal(t, "cpu_seconds_total", perKindStringField(t, h, "metric"))
			require.Equal(t, "ds-prom", perKindStringField(t, h, "targetDatasourceUID"))
		})
	})

	// A field the other kind declares is not part of this kind's contract, so
	// naming it is a rejected kindQuery rather than one that answers with nothing.
	t.Run("rejects a perKindQuery naming another kind's field", func(t *testing.T) {
		payload, err := json.Marshal(newPerKindQuery().fields("metric").body)
		require.NoError(t, err)
		_, err = rc.Post().
			AbsPath("apis", v0alpha1.APIGroup, v0alpha1.APIVersion, "namespaces", "default", alertRules, "search").
			Body(payload).
			DoRaw(ctx)
		require.Error(t, err)
	})

	t.Run("default perKindTitle order is case-insensitive", func(t *testing.T) {
		createPerKindAlertRule(t, ctx, alertClient, "zebra case", false, nil, "ds-prom", 2000)
		createPerKindAlertRule(t, ctx, alertClient, "Apple case", false, nil, "ds-prom", 2001)
		require.Equal(t, []string{"Apple case", "zebra case"},
			perKindTitles(searchAlerts(t, newPerKindQuery().text("case"))))
	})

	t.Run("consistency: search matches list", func(t *testing.T) {
		list, err := alertClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, searchAlerts(t, nil).Items, len(list.Items))
	})
}

// Field readers. A hit's fields are an open JSON object, because that is what the
// generic endpoint returns; the tests read through it by name.

func perKindFieldValues(h searchv0.ResultItem) map[string]any {
	if h.Fields == nil {
		return nil
	}
	return h.Fields.Object
}

func perKindFieldNames(h searchv0.ResultItem) []string {
	values := perKindFieldValues(h)
	out := make([]string, 0, len(values))
	for name := range values {
		out = append(out, name)
	}
	return out
}

func perKindStringField(t *testing.T, h searchv0.ResultItem, name string) string {
	t.Helper()
	v, ok := perKindFieldValues(h)[name]
	require.True(t, ok, "hit is missing field %q", name)
	s, ok := v.(string)
	require.True(t, ok, "field %q is %T, not a string", name, v)
	return s
}

func perKindNumberField(t *testing.T, h searchv0.ResultItem, name string) float64 {
	t.Helper()
	v, ok := perKindFieldValues(h)[name]
	require.True(t, ok, "hit is missing field %q", name)
	n, ok := v.(float64)
	require.True(t, ok, "field %q is %T, not a number", name, v)
	return n
}

func perKindTitle(h searchv0.ResultItem) string {
	s, _ := perKindFieldValues(h)["title"].(string)
	return s
}

func perKindTitles(resp searchv0.SearchResults) []string {
	out := make([]string, 0, len(resp.Items))
	for _, h := range resp.Items {
		out = append(out, perKindTitle(h))
	}
	return out
}

func perKindHitFor(t *testing.T, resp searchv0.SearchResults, want string) searchv0.ResultItem {
	t.Helper()
	for _, h := range resp.Items {
		if perKindTitle(h) == want {
			return h
		}
	}
	require.FailNowf(t, "hit not found", "no hit titled %q in %v", want, perKindTitles(resp))
	return searchv0.ResultItem{}
}

func createPerKindAlertRule(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList], perKindTitle string, paused bool, labels map[string]string, dsUID string, panelID int64) {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(perKindSearchFolder),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	rule := &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Name:        base.UID,
			Namespace:   "default",
			Annotations: map[string]string{v0alpha1.FolderAnnotationKey: perKindSearchFolder},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title:        perKindTitle,
			Paused:       new(paused),
			Labels:       perKindTemplateLabels(labels),
			Expressions:  perKindAlertExpressions(base, dsUID),
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

func createPerKindRecordingRule(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.RecordingRule, v0alpha1.RecordingRuleList], perKindTitle, dsUID, metric string) {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(perKindSearchFolder),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	rule := &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Name:        base.UID,
			Namespace:   "default",
			Annotations: map[string]string{v0alpha1.FolderAnnotationKey: perKindSearchFolder},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:               perKindTitle,
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

func perKindAlertExpressions(base ngmodels.AlertRule, dsUID string) v0alpha1.AlertRuleExpressionMap {
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

func perKindTemplateLabels(labels map[string]string) map[string]v0alpha1.AlertRuleTemplateString {
	if len(labels) == 0 {
		return nil
	}
	out := make(map[string]v0alpha1.AlertRuleTemplateString, len(labels))
	for k, v := range labels {
		out[k] = v0alpha1.AlertRuleTemplateString(v)
	}
	return out
}

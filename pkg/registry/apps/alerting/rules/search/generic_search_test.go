package search

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/testsuite"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	genericsearch "github.com/grafana/grafana/pkg/registry/apis/search"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	accesscontrol "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	unifiedresource "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// fakeRuleAuthz is a minimal provisioning.RuleAccessControlService: canReadAll
// grants blanket access (mirroring an org admin/provisioning-read caller);
// otherwise HasAccessInFolder gates access per folder UID, mirroring a Viewer
// scoped to a subset of folders.
type fakeRuleAuthz struct {
	canReadAll      bool
	readableFolders map[string]bool
}

func (f *fakeRuleAuthz) HasAccess(context.Context, identity.Requester, accesscontrol.Evaluator) (bool, error) {
	return f.canReadAll, nil
}
func (f *fakeRuleAuthz) AuthorizeAccessToRuleGroup(context.Context, identity.Requester, ngmodels.RulesGroup) error {
	return nil
}
func (f *fakeRuleAuthz) AuthorizeAccessInFolder(context.Context, identity.Requester, ngmodels.Namespaced) error {
	return nil
}
func (f *fakeRuleAuthz) AuthorizeRuleChanges(context.Context, identity.Requester, *store.GroupDelta) error {
	return nil
}
func (f *fakeRuleAuthz) HasAccessInFolder(_ context.Context, _ identity.Requester, ns ngmodels.Namespaced) (bool, error) {
	return f.readableFolders[ns.GetNamespaceUID()], nil
}

// testLegacyClient wires a real (SQLite-backed) provisioning.AlertRuleService
// behind legacyClient, the same way register.go does, so these tests exercise
// the real folder-scoping and filter logic the store applies, not a fake
// standing in for it.
func testLegacyClient(t *testing.T, folders []*folder.Folder, authz *fakeRuleAuthz) (*legacyClient, *store.DBstore) {
	t.Helper()
	sqlStore := db.InitTestDB(t) //nolint:staticcheck
	fs := foldertest.NewFakeService()
	fs.ExpectedFolders = folders

	dbstore := &store.DBstore{
		SQLStore:       sqlStore,
		Cfg:            setting.UnifiedAlertingSettings{BaseInterval: 10 * time.Second},
		Logger:         log.NewNopLogger(),
		FolderService:  fs,
		Bus:            bus.ProvideBus(tracing.InitializeTracerForTest()),
		FeatureToggles: featuremgmt.WithFeatures(),
	}

	svc := provisioning.NewAlertRuleService(dbstore, dbstore, fs, nil, sqlStore, 60, 10, 100, log.NewNopLogger(), nil, authz, nil)
	return NewLegacyClient(*svc), dbstore
}

func toInsertRules(rules []ngmodels.AlertRule) []ngmodels.InsertRule {
	out := make([]ngmodels.InsertRule, 0, len(rules))
	for _, r := range rules {
		out = append(out, ngmodels.InsertRule{AlertRule: r})
	}
	return out
}

func seedRules(t *testing.T, dbstore *store.DBstore, rules []ngmodels.AlertRule) {
	t.Helper()
	_, err := dbstore.InsertAlertRules(context.Background(), &ngmodels.AlertingUserUID, toInsertRules(rules))
	require.NoError(t, err)
}

func requesterCtx(orgID int64) context.Context {
	return identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: orgID})
}

// genericFieldsProvider is the same manifest-backed provider the generic
// route's translator validates rule fields against in production (see
// fields.go / per_kind_fields.go, which build the identical provider for the
// legacy path).
func genericFieldsProvider() unifiedresource.SearchFieldsProvider {
	return unifiedresource.NewManifestBackedProvider(rulesmanifest.LocalManifest().ManifestData)
}

func searchQueryMeta() metav1.TypeMeta {
	return metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery}
}

// translateGeneric runs a SearchQuery through the *generic* /search
// translator (pkg/registry/apis/search/translate.go) for the alert rule
// GroupResource -- the encoder the new generic route actually uses, distinct
// from the per-kind translator in per_kind_query.go.
func translateGeneric(t *testing.T, q *searchv0.SearchQuery, namespace string) *resourcepb.ResourceSearchRequest {
	t.Helper()
	gr := alertrule.ResourceInfo.GroupResource()
	gvr := schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource}
	req, errs := genericsearch.TranslateSearchQuery(q, gvr, namespace, genericFieldsProvider())
	require.Empty(t, errs, "%v", errs)
	return req
}

func titlesOf(t *testing.T, resp *resourcepb.ResourceSearchResponse) []string {
	t.Helper()
	var titles []string
	cols := resp.GetResults().GetColumns()
	for _, row := range resp.GetResults().GetRows() {
		for i, col := range cols {
			if col.GetName() != fieldTitle {
				continue
			}
			v, err := unifiedresource.DecodeCell(col, i, row.GetCells()[i])
			require.NoError(t, err)
			s, _ := v.(string)
			titles = append(titles, s)
		}
	}
	return titles
}

// TestGenericSearchAgainstTranslator feeds SearchQuery bodies through the
// generic /search translator directly into legacyClient, the same client
// /searchRules already exercises through its own translator
// (per_kind_query.go). The two encoders must agree on field names, operator
// spellings, and result/continuation shape -- the risk flagged before
// implementation: per_kind_query_test.go already covers the per-kind encoder,
// this covers the generic one.
func TestGenericSearchAgainstTranslator(t *testing.T) {
	folders := []*folder.Folder{{OrgID: 1, UID: "f1", Title: "Folder 1"}, {OrgID: 1, UID: "f2", Title: "Folder 2"}}
	authz := &fakeRuleAuthz{canReadAll: true}
	client, dbstore := testLegacyClient(t, folders, authz)
	ctx := requesterCtx(1)

	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithOrgID(1),
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithIntervalSeconds(10),
	)
	cpuAlpha := base.With(ngmodels.RuleMuts.WithTitle("cpu-alpha"), ngmodels.RuleMuts.WithNamespaceUID("f1"),
		ngmodels.RuleMuts.WithLabel("team", "a")).GenerateRef()
	cpuBeta := base.With(ngmodels.RuleMuts.WithTitle("cpu-beta"), ngmodels.RuleMuts.WithNamespaceUID("f2"),
		ngmodels.RuleMuts.WithLabel("team", "b")).GenerateRef()
	memGamma := base.With(ngmodels.RuleMuts.WithTitle("mem-gamma"), ngmodels.RuleMuts.WithNamespaceUID("f1"),
		ngmodels.RuleMuts.WithLabel("__grafana_origin", "plugin/x")).GenerateRef()
	seedRules(t, dbstore, []ngmodels.AlertRule{*cpuAlpha, *cpuBeta, *memGamma})

	t.Run("text", func(t *testing.T) {
		q := &searchv0.SearchQuery{
			TypeMeta: searchQueryMeta(),
			Where:    &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu"}},
			Sort:     []searchv0.SortField{{Field: fieldTitle, Direction: sortAscending}},
			Limit:    40,
		}
		req := translateGeneric(t, q, "default")
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"cpu-alpha", "cpu-beta"}, titlesOf(t, resp))
	})

	t.Run("folder in", func(t *testing.T) {
		q := &searchv0.SearchQuery{
			TypeMeta: searchQueryMeta(),
			Where: &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{
				Field: fieldFolder, Operator: "In", Values: []string{"f1"},
			}},
			Sort:  []searchv0.SortField{{Field: fieldTitle, Direction: sortAscending}},
			Limit: 40,
		}
		req := translateGeneric(t, q, "default")
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"cpu-alpha", "mem-gamma"}, titlesOf(t, resp))
	})

	t.Run("labels in key=value", func(t *testing.T) {
		q := &searchv0.SearchQuery{
			TypeMeta: searchQueryMeta(),
			Where: &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{
				Field: fieldLabels, Operator: "In", Values: []string{"team=a"},
			}},
			Limit: 40,
		}
		req := translateGeneric(t, q, "default")
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		assert.Equal(t, []string{"cpu-alpha"}, titlesOf(t, resp))
	})

	t.Run("labels notin key (plugin hide)", func(t *testing.T) {
		q := &searchv0.SearchQuery{
			TypeMeta: searchQueryMeta(),
			Where: &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{
				Field: fieldLabels, Operator: "NotIn", Values: []string{"__grafana_origin"},
			}},
			Sort:  []searchv0.SortField{{Field: fieldTitle, Direction: sortAscending}},
			Limit: 40,
		}
		req := translateGeneric(t, q, "default")
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"cpu-alpha", "cpu-beta"}, titlesOf(t, resp))
	})

	t.Run("fields including status", func(t *testing.T) {
		q := &searchv0.SearchQuery{
			TypeMeta: searchQueryMeta(),
			Fields:   []string{fieldTitle, fieldHealth, fieldState},
			Limit:    40,
		}
		req := translateGeneric(t, q, "default")
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		assert.Len(t, resp.GetResults().GetRows(), 3)
	})

	t.Run("limit and continue page through every row exactly once", func(t *testing.T) {
		q := &searchv0.SearchQuery{
			TypeMeta: searchQueryMeta(),
			Sort:     []searchv0.SortField{{Field: fieldTitle, Direction: sortAscending}},
			Limit:    1,
		}
		req := translateGeneric(t, q, "default")
		var seen []string
		for i := 0; i < 10; i++ {
			resp, err := client.Search(ctx, req)
			require.NoError(t, err)
			rows := resp.GetResults().GetRows()
			if len(rows) == 0 {
				break
			}
			seen = append(seen, titlesOf(t, resp)...)
			last := rows[len(rows)-1]
			require.NotEmpty(t, last.GetSortFields(), "legacy rows must carry a sort cursor for the generic route to resume from")
			req.SearchAfter = last.GetSortFields()
			if int64(len(seen)) >= resp.GetTotalHits() {
				break
			}
		}
		assert.ElementsMatch(t, []string{"cpu-alpha", "cpu-beta", "mem-gamma"}, seen)
	})
}

// TestGenericSearchFieldsProjection proves the legacy path returns only the
// requested fields, matching the unified path's projection behavior: a
// client asking for title/folder/state/health must not also get every other
// declared field back.
func TestGenericSearchFieldsProjection(t *testing.T) {
	folders := []*folder.Folder{{OrgID: 1, UID: "f1", Title: "Folder 1"}}
	authz := &fakeRuleAuthz{canReadAll: true}
	client, dbstore := testLegacyClient(t, folders, authz)
	ctx := requesterCtx(1)

	base := ngmodels.RuleGen.With(ngmodels.RuleMuts.WithOrgID(1), ngmodels.RuleMuts.WithUniqueUID(), ngmodels.RuleMuts.WithIntervalSeconds(10))
	rule := base.With(ngmodels.RuleMuts.WithTitle("projected-rule"), ngmodels.RuleMuts.WithNamespaceUID("f1"),
		ngmodels.RuleMuts.WithLabel("team", "a")).GenerateRef()
	seedRules(t, dbstore, []ngmodels.AlertRule{*rule})

	q := &searchv0.SearchQuery{TypeMeta: searchQueryMeta(), Fields: []string{fieldTitle, fieldFolder, fieldState, fieldHealth}, Limit: 40}
	req := translateGeneric(t, q, "default")
	resp, err := client.Search(ctx, req)
	require.NoError(t, err)

	require.Len(t, resp.GetResults().GetRows(), 1)
	var gotCols []string
	for _, col := range resp.GetResults().GetColumns() {
		gotCols = append(gotCols, col.GetName())
	}
	assert.ElementsMatch(t, []string{fieldTitle, fieldFolder, fieldState, fieldHealth}, gotCols,
		"only the requested fields should come back, not every declared field (e.g. labels, datasourceUIDs)")
}

// TestGenericSearchFieldsProjection_DefaultsToTitleAndFolder proves an empty
// fields list still defaults to title+folder, matching both translators'
// default projection, rather than returning nothing or every field.
func TestGenericSearchFieldsProjection_DefaultsToTitleAndFolder(t *testing.T) {
	folders := []*folder.Folder{{OrgID: 1, UID: "f1", Title: "Folder 1"}}
	authz := &fakeRuleAuthz{canReadAll: true}
	client, dbstore := testLegacyClient(t, folders, authz)
	ctx := requesterCtx(1)

	base := ngmodels.RuleGen.With(ngmodels.RuleMuts.WithOrgID(1), ngmodels.RuleMuts.WithUniqueUID(), ngmodels.RuleMuts.WithIntervalSeconds(10))
	rule := base.With(ngmodels.RuleMuts.WithTitle("default-fields-rule"), ngmodels.RuleMuts.WithNamespaceUID("f1")).GenerateRef()
	seedRules(t, dbstore, []ngmodels.AlertRule{*rule})

	q := &searchv0.SearchQuery{TypeMeta: searchQueryMeta(), Limit: 40}
	req := translateGeneric(t, q, "default")
	resp, err := client.Search(ctx, req)
	require.NoError(t, err)

	var gotCols []string
	for _, col := range resp.GetResults().GetColumns() {
		gotCols = append(gotCols, col.GetName())
	}
	assert.ElementsMatch(t, []string{fieldTitle, fieldFolder}, gotCols)
}

// TestGenericSearchParity_NotInAndRegex covers the filter parity the generic
// route needs beyond what /searchRules ever exercised: NotIn on folder/paused/
// notificationType, and regex(+negate) on labels.
func TestGenericSearchParity_NotInAndRegex(t *testing.T) {
	folders := []*folder.Folder{{OrgID: 1, UID: "f1", Title: "Folder 1"}, {OrgID: 1, UID: "f2", Title: "Folder 2"}}
	authz := &fakeRuleAuthz{canReadAll: true}
	client, dbstore := testLegacyClient(t, folders, authz)
	ctx := requesterCtx(1)

	base := ngmodels.RuleGen.With(ngmodels.RuleMuts.WithOrgID(1), ngmodels.RuleMuts.WithUniqueUID(), ngmodels.RuleMuts.WithIntervalSeconds(10))
	inF1 := base.With(ngmodels.RuleMuts.WithTitle("in-f1"), ngmodels.RuleMuts.WithNamespaceUID("f1")).GenerateRef()
	inF2 := base.With(ngmodels.RuleMuts.WithTitle("in-f2"), ngmodels.RuleMuts.WithNamespaceUID("f2")).GenerateRef()
	paused := base.With(ngmodels.RuleMuts.WithTitle("paused-rule"), ngmodels.RuleMuts.WithNamespaceUID("f1")).GenerateRef()
	paused.IsPaused = true
	notPaused := base.With(ngmodels.RuleMuts.WithTitle("active-rule"), ngmodels.RuleMuts.WithNamespaceUID("f1")).GenerateRef()
	notPaused.IsPaused = false
	simplified := base.With(ngmodels.RuleMuts.WithTitle("simplified-routing"), ngmodels.RuleMuts.WithNamespaceUID("f1")).GenerateRef()
	simplified.NotificationSettings = &ngmodels.NotificationSettings{
		ContactPointRouting: &ngmodels.ContactPointRouting{Receiver: "slack"},
	}
	noSettings := base.With(ngmodels.RuleMuts.WithTitle("default-policy"), ngmodels.RuleMuts.WithNamespaceUID("f1")).GenerateRef()
	noSettings.NotificationSettings = nil
	teamA := base.With(ngmodels.RuleMuts.WithTitle("team-a-rule"), ngmodels.RuleMuts.WithNamespaceUID("f1"),
		ngmodels.RuleMuts.WithLabel("team", "alpha")).GenerateRef()
	teamB := base.With(ngmodels.RuleMuts.WithTitle("team-b-rule"), ngmodels.RuleMuts.WithNamespaceUID("f1"),
		ngmodels.RuleMuts.WithLabel("team", "beta")).GenerateRef()

	seedRules(t, dbstore, []ngmodels.AlertRule{
		*inF1, *inF2, *paused, *notPaused, *simplified, *noSettings, *teamA, *teamB,
	})

	run := func(t *testing.T, q *searchv0.SearchQuery) []string {
		q.TypeMeta = searchQueryMeta()
		if q.Limit == 0 {
			q.Limit = 40
		}
		req := translateGeneric(t, q, "default")
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		return titlesOf(t, resp)
	}

	t.Run("NotIn folder", func(t *testing.T) {
		got := run(t, &searchv0.SearchQuery{
			Where: &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: fieldFolder, Operator: "NotIn", Values: []string{"f2"}}},
		})
		assert.NotContains(t, got, "in-f2")
		assert.Contains(t, got, "in-f1")
	})

	t.Run("NotIn paused matches not-paused rules", func(t *testing.T) {
		got := run(t, &searchv0.SearchQuery{
			Where: &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: fieldPaused, Operator: "NotIn", Values: []string{"true"}}},
		})
		assert.Contains(t, got, "active-rule")
		assert.NotContains(t, got, "paused-rule")
	})

	t.Run("NotIn both notification types returns default policy rules", func(t *testing.T) {
		got := run(t, &searchv0.SearchQuery{
			Where: &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{
				Field: fieldNotificationType, Operator: "NotIn",
				Values: []string{string(ngmodels.NotificationSettingsTypeSimplifiedRouting), string(ngmodels.NotificationSettingsTypeNamedRoutingTree)},
			}},
		})
		assert.Contains(t, got, "default-policy")
		assert.NotContains(t, got, "simplified-routing")
	})

	t.Run("labels regex", func(t *testing.T) {
		got := run(t, &searchv0.SearchQuery{
			Where: &searchv0.WhereNode{Regex: &searchv0.RegexPredicate{Field: fieldLabels, Pattern: "team=al.*"}},
		})
		assert.Equal(t, []string{"team-a-rule"}, got)
	})

	t.Run("labels regex negate", func(t *testing.T) {
		got := run(t, &searchv0.SearchQuery{
			Where: &searchv0.WhereNode{Regex: &searchv0.RegexPredicate{Field: fieldLabels, Pattern: "team=al.*", Negate: true}},
		})
		assert.NotContains(t, got, "team-a-rule")
		assert.Contains(t, got, "team-b-rule")
	})
}

// TestGenericSearchAuthorization_FolderScoped proves the generic route
// authorizes results per folder exactly as /searchRules does: a caller who can
// only read one folder sees only that folder's rules, never a 403 merely
// because the route is a POST (see ruleSearchReadAttributes in register.go).
func TestGenericSearchAuthorization_FolderScoped(t *testing.T) {
	folders := []*folder.Folder{{OrgID: 1, UID: "f1", Title: "Folder 1"}, {OrgID: 1, UID: "f2", Title: "Folder 2"}}
	viewer := &fakeRuleAuthz{canReadAll: false, readableFolders: map[string]bool{"f1": true}}
	client, dbstore := testLegacyClient(t, folders, viewer)
	ctx := requesterCtx(1)

	base := ngmodels.RuleGen.With(ngmodels.RuleMuts.WithOrgID(1), ngmodels.RuleMuts.WithUniqueUID(), ngmodels.RuleMuts.WithIntervalSeconds(10))
	readable := base.With(ngmodels.RuleMuts.WithTitle("readable-rule"), ngmodels.RuleMuts.WithNamespaceUID("f1")).GenerateRef()
	hidden := base.With(ngmodels.RuleMuts.WithTitle("hidden-rule"), ngmodels.RuleMuts.WithNamespaceUID("f2")).GenerateRef()
	seedRules(t, dbstore, []ngmodels.AlertRule{*readable, *hidden})

	q := &searchv0.SearchQuery{TypeMeta: searchQueryMeta(), Limit: 40}
	req := translateGeneric(t, q, "default")
	resp, err := client.Search(ctx, req)
	require.NoError(t, err, "a folder-scoped Viewer must not be rejected by the search route itself")
	assert.Equal(t, []string{"readable-rule"}, titlesOf(t, resp))
}

package search

import (
	"context"
	"errors"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	appresource "github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestLegacyBackendMatchesTableResponses(t *testing.T) {
	for name, rule := range map[string]*ngmodels.AlertRule{"alert": testAlertRule(), "minimal": minimalAlertRule(), "recording": testRecordingRule()} {
		for _, perKind := range []bool{false, true} {
			t.Run(name+map[bool]string{false: "/combined", true: "/per-kind"}[perKind], func(t *testing.T) {
				rule.K8sStatus = []byte(`{"health":"OK","state":"Normal","evaluationDuration":0}`)
				h, _, ctx := legacyStatusHandler(t, rule)
				values := ruleColumnValues(rule)
				if perKind {
					(&legacyClient{logger: &logtest.Fake{}}).addStatusValues(rule, values)
				}
				cells, err := ruleCells(values)
				require.NoError(t, err)
				wire := &resourcepb.ResourceSearchResponse{TotalHits: 1, TotalHitsExact: true, Results: &resourcepb.ResourceTable{
					Columns: resultColumnDefinitions(), Rows: []*resourcepb.ResourceTableRow{{Key: ruleKey("default", rule), Cells: cells}},
				}}
				unified := newUnifiedHandler(&fakeIndex{resp: wire}, &fakeIndex{resp: wire})
				legacyRoute, unifiedRoute := h.SearchRules, unified.SearchRules
				body := `{}`
				if perKind {
					kind := alertRuleKind(t)
					legacyRoute, unifiedRoute = h.SearchAlertRules, unified.SearchAlertRules
					if rule.Type() == ngmodels.RuleTypeRecording {
						kind = recordingRuleKind(t)
						legacyRoute, unifiedRoute = h.SearchRecordingRules, unified.SearchRecordingRules
					}
					var fields []string
					for _, field := range resultColumns {
						if kind.fields.known(field) {
							fields = append(fields, field)
						}
					}
					body = projection(fields...)
				}
				call := func(route routeHandler) string {
					w := httptest.NewRecorder()
					require.NoError(t, route(ctx, w, &app.CustomRouteRequest{ResourceIdentifier: appresource.FullIdentifier{Namespace: "default"}, Body: readCloser(body)}))
					require.Equal(t, 200, w.Code)
					return w.Body.String()
				}
				require.JSONEq(t, call(unifiedRoute), call(legacyRoute))
			})
		}
	}
}

type ruleSearchStore struct {
	provisioning.RuleStore
	rules     ngmodels.RulesGroup
	query     *ngmodels.ListAlertRulesExtendedQuery
	err       error
	requester identity.Requester
}

func (s *ruleSearchStore) ListAlertRulesPaginated(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error) {
	s.query = query
	s.requester, _ = identity.GetRequester(ctx)
	return slices.Clone(s.rules), "", s.err
}

func legacyBackendForTest(store *ruleSearchStore) *legacyClient {
	service := provisioning.NewAlertRuleService(store, fakes.NewFakeProvisioningStore(), nil, nil, nil,
		60, 10, 0, &logtest.Fake{}, nil, statusSearchAccessControl{}, nil)
	return NewLegacyClient(*service)
}

func TestLegacyBackendFilteringAndPagination(t *testing.T) {
	store := &ruleSearchStore{rules: ngmodels.RulesGroup{
		{UID: "b", Title: "banana", Labels: map[string]string{"team": "a"}},
		{UID: "c", Title: "apple", Labels: map[string]string{"team": "a"}},
		{UID: "a", Title: "Banana", Labels: map[string]string{"team": "a"}},
		{UID: "excluded", Title: "Apricot", Labels: map[string]string{"team": "b"}},
	}}
	backend := legacyBackendForTest(store)
	requester := &identity.StaticRequester{OrgID: 1, UserID: 2}
	ctx := identity.WithRequester(t.Context(), requester)
	for _, tc := range []struct {
		perKind bool
		want    string
	}{
		{false, "c"}, // Case-sensitive combined order: Banana, apple, banana.
		{true, "a"},  // Per-kind order: apple, Banana, banana, with UID ties ascending.
	} {
		query := &Query{Primary: alertrule.ResourceInfo.GroupResource(), PerKind: tc.perKind, Limit: 1, Offset: 1}
		query.Filters = append(query.Filters, labelMatcherRequirement(labelMatcher{key: "team", value: "a", op: matchEquals}))
		result, err := backend.Search(ctx, query)
		require.NoError(t, err)
		require.Equal(t, int64(3), result.TotalHits)
		require.True(t, result.TotalHitsExact)
		require.Len(t, result.Hits, 1)
		require.Equal(t, tc.want, result.Hits[0].Name)
		require.Same(t, requester, store.requester)
		require.Equal(t, int64(1), store.query.OrgID)
		require.Equal(t, ngmodels.RuleTypeFilterAlerting, store.query.RuleType)
	}
}

func TestLegacyBackendKindSelection(t *testing.T) {
	store := &ruleSearchStore{}
	backend := legacyBackendForTest(store)
	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{OrgID: 1})
	alert := alertrule.ResourceInfo.GroupResource()
	recording := recordingrule.ResourceInfo.GroupResource()
	query := &Query{Primary: recording, Limit: 10}
	_, err := backend.Search(ctx, query)
	require.NoError(t, err)
	require.Equal(t, ngmodels.RuleTypeFilterRecording, store.query.RuleType)
	query.Primary = alert
	query.Federated = append(query.Federated, recording)
	_, err = backend.Search(ctx, query)
	require.NoError(t, err)
	require.Equal(t, ngmodels.RuleTypeFilterAll, store.query.RuleType)

	store.query = nil
	filter := perKindFilterLeaf(fieldType, "In", ruleTypeRecording)
	query = translate(t, whereQuery(&filter))
	result, err := backend.Search(ctx, query)
	require.NoError(t, err)
	require.Empty(t, result.Hits)
	require.True(t, result.TotalHitsExact)
	require.Nil(t, store.query, "contradictory per-kind filter must not query SQL")
}

func TestLegacyBackendErrors(t *testing.T) {
	wantErr := errors.New("store unavailable")
	store := &ruleSearchStore{err: wantErr}
	backend := legacyBackendForTest(store)
	query := &Query{Primary: alertrule.ResourceInfo.GroupResource(), Limit: 10}
	_, err := backend.Search(t.Context(), query)
	require.Error(t, err)
	require.Nil(t, store.query)
	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{OrgID: 1})
	_, err = backend.Search(ctx, query)
	require.ErrorIs(t, err, wantErr)
}

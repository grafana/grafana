package teamlbac

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
)

type getterFunc func(context.Context, string, *metav1.GetOptions) (runtime.Object, error)

func (f getterFunc) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return f(ctx, name, options)
}

type listerFunc func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error)

func (f listerFunc) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	return f(ctx, options)
}

type testResponder struct {
	status int
	obj    runtime.Object
	err    error
}

func (r *testResponder) Object(status int, obj runtime.Object) {
	r.status = status
	r.obj = obj
}

func (r *testResponder) Error(err error) {
	r.err = err
}

func TestRulesForSubjectRESTGetRulesForUser(t *testing.T) {
	rule := &iamv0.TeamLBACRule{
		Spec: iamv0.TeamLBACRuleSpec{
			TeamFilters: map[string][]string{
				"team-a": {`foo="a"`},
				"team-b": {`foo="b"`},
				"42":     {`legacy="yes"`},
			},
		},
	}
	ruleGetter := getterFunc(func(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
		require.Equal(t, "prometheus.datasource-a", name)
		return rule, nil
	})
	teamLister := listerFunc(func(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
		requester, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.True(t, requester.IsIdentityType(claims.TypeAccessPolicy))
		require.Equal(t, int64(common.MaxListLimit), options.Limit)
		require.Nil(t, options.LabelSelector)
		legacyTeam := teamWithMembers("team-old", "user-a")
		legacyTeam.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: "42"} //nolint:staticcheck // legacy rule compatibility
		return &iamv0.TeamList{Items: []iamv0.Team{
			*teamWithMembers("team-a", "user-a"),
			*teamWithMembers("team-b", "another-user"),
			*teamWithMembers("unrelated-team", "user-a"),
			*legacyTeam,
		}}, nil
	})

	handler := NewRulesForSubjectREST(ruleGetter, teamLister, tracing.NewNoopTracerService(), nil)
	response, outcome, err := handler.getRulesForUser(context.Background(), "prometheus.datasource-a", "user-a")
	require.NoError(t, err)
	require.Equal(t, forSubjectOutcomeFiltersReturned, outcome)
	require.Equal(t, map[string][]string{
		"team-a": {`foo="a"`},
		"42":     {`legacy="yes"`},
	}, response.TeamFilters)
}

func TestRulesForSubjectRESTIgnoresMissingTeams(t *testing.T) {
	ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{
			TeamFilters: map[string][]string{"deleted-team": {`foo="bar"`}},
		}}, nil
	})
	teamLister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		return &iamv0.TeamList{}, nil
	})

	handler := NewRulesForSubjectREST(ruleGetter, teamLister, tracing.NewNoopTracerService(), nil)
	response, outcome, err := handler.getRulesForUser(context.Background(), "prometheus.datasource-a", "user-a")
	require.NoError(t, err)
	require.Equal(t, forSubjectOutcomeNoTeamMembership, outcome)
	require.Empty(t, response.TeamFilters)
}

func TestRulesForSubjectRESTPropagatesRuleReadErrors(t *testing.T) {
	wantErr := errors.New("rule read failed")
	ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		return nil, wantErr
	})
	unusedLister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		t.Fatal("team lister should not be called")
		return nil, nil
	})

	handler := NewRulesForSubjectREST(ruleGetter, unusedLister, tracing.NewNoopTracerService(), nil)
	response, outcome, err := handler.getRulesForUser(context.Background(), "prometheus.datasource-a", "user-a")
	require.ErrorIs(t, err, wantErr)
	require.Nil(t, response)
	require.Empty(t, outcome)
}

func TestRulesForSubjectRESTConnectReturnsEmptyRulesWhenRuleDoesNotExist(t *testing.T) {
	ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		return nil, apierrors.NewNotFound(iamv0.TeamLBACRuleInfo.GroupResource(), "prometheus.datasource-a")
	})
	unusedLister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		t.Fatal("team lister should not be called")
		return nil, nil
	})
	handler := NewRulesForSubjectREST(ruleGetter, unusedLister, tracing.NewNoopTracerService(), nil)
	responder := &testResponder{}
	httpHandler, err := handler.Connect(context.Background(), "prometheus.datasource-a", nil, responder)
	require.NoError(t, err)

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "org-1"})
	ctx = k8srequest.WithRequestInfo(ctx, &k8srequest.RequestInfo{Parts: subjectRequestParts("user", "user-a")})
	req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
	httpHandler.ServeHTTP(httptest.NewRecorder(), req)

	require.NoError(t, responder.err)
	require.Equal(t, http.StatusOK, responder.status)
	response, ok := responder.obj.(*iamv0.GetTeamLBACRulesForSubjectResponse)
	require.True(t, ok)
	require.Empty(t, response.TeamFilters)
}

func TestRulesForSubjectRESTValidatesSubject(t *testing.T) {
	unusedGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		t.Fatal("storage should not be called")
		return nil, nil
	})
	unusedLister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		t.Fatal("storage should not be called")
		return nil, nil
	})
	handler := NewRulesForSubjectREST(unusedGetter, unusedLister, tracing.NewNoopTracerService(), nil)

	tests := []struct {
		name  string
		parts []string
	}{
		{name: "missing path parameters", parts: []string{"teamlbacrules", "prometheus.datasource-a", "for-subject"}},
		{name: "unsupported subject type", parts: subjectRequestParts("service-account", "sa-a")},
		{name: "missing subject UID", parts: subjectRequestParts("user", "")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			responder := &testResponder{}
			httpHandler, err := handler.Connect(context.Background(), "prometheus.datasource-a", nil, responder)
			require.NoError(t, err)
			ctx := k8srequest.WithRequestInfo(context.Background(), &k8srequest.RequestInfo{Parts: tt.parts})
			req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
			httpHandler.ServeHTTP(httptest.NewRecorder(), req)
			require.True(t, apierrors.IsBadRequest(responder.err))
			require.Nil(t, responder.obj)
		})
	}
}

func TestRulesForSubjectRESTConnectReturnsRules(t *testing.T) {
	ruleGetter := getterFunc(func(ctx context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
		require.Equal(t, "org-1", k8srequest.NamespaceValue(ctx))
		requester, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.True(t, requester.IsIdentityType(claims.TypeAccessPolicy))
		return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{
			TeamFilters: map[string][]string{"team-a": {`foo="bar"`}},
		}}, nil
	})
	teamLister := listerFunc(func(ctx context.Context, _ *metainternalversion.ListOptions) (runtime.Object, error) {
		require.Equal(t, "org-1", k8srequest.NamespaceValue(ctx))
		requester, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.True(t, requester.IsIdentityType(claims.TypeAccessPolicy))
		return &iamv0.TeamList{Items: []iamv0.Team{*teamWithMembers("team-a", "user-a")}}, nil
	})
	handler := NewRulesForSubjectREST(ruleGetter, teamLister, tracing.NewNoopTracerService(), nil)
	responder := &testResponder{}
	httpHandler, err := handler.Connect(context.Background(), "prometheus.datasource-a", nil, responder)
	require.NoError(t, err)

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "org-1"})
	ctx = k8srequest.WithRequestInfo(ctx, &k8srequest.RequestInfo{Parts: subjectRequestParts("user", "user-a")})
	req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
	httpHandler.ServeHTTP(httptest.NewRecorder(), req)

	require.NoError(t, responder.err)
	require.Equal(t, http.StatusOK, responder.status)
	response, ok := responder.obj.(*iamv0.GetTeamLBACRulesForSubjectResponse)
	require.True(t, ok)
	require.Equal(t, map[string][]string{"team-a": {`foo="bar"`}}, response.TeamFilters)
}

func TestRulesForSubjectRESTListsTeamsOnceForLargeRules(t *testing.T) {
	for _, numeric := range []bool{false, true} {
		for _, member := range []bool{false, true} {
			t.Run(fmt.Sprintf("numeric=%t/member=%t", numeric, member), func(t *testing.T) {
				filters := make(map[string][]string, 144)
				teams := make([]iamv0.Team, 0, 144)
				for i := range 144 {
					key := fmt.Sprintf("team-%d", i)
					team := teamWithMembers(key, "other-user")
					if numeric {
						key = fmt.Sprint(1000 + i)
						team.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: key} //nolint:staticcheck // legacy rule compatibility
					}
					filters[key] = []string{`foo="bar"`}
					if member && i == 143 {
						team.Spec.Members = append(team.Spec.Members, iamv0.TeamTeamMember{Name: "user-a"})
					}
					teams = append(teams, *team)
				}
				ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
					return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: filters}}, nil
				})
				calls := 0
				lister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
					calls++
					return &iamv0.TeamList{Items: teams}, nil
				})
				handler := NewRulesForSubjectREST(ruleGetter, lister, tracing.NewNoopTracerService(), nil)
				response, outcome, err := handler.getRulesForUser(t.Context(), "prometheus.datasource-a", "user-a")
				require.NoError(t, err)
				require.Equal(t, 1, calls)
				if member {
					key := "team-143"
					if numeric {
						key = "1143"
					}
					require.Equal(t, map[string][]string{key: {`foo="bar"`}}, response.TeamFilters)
					require.Equal(t, forSubjectOutcomeFiltersReturned, outcome)
				} else {
					require.Empty(t, response.TeamFilters)
					require.Equal(t, forSubjectOutcomeNoTeamMembership, outcome)
				}
			})
		}
	}
}

func TestRulesForSubjectRESTPaginatesTeams(t *testing.T) {
	for _, namespace := range []string{"org-1", "stacks-27821"} {
		t.Run(namespace, func(t *testing.T) {
			filters := map[string][]string{"team-a": {`a="1"`}, "team-b": {`b="2"`}, "42": {`legacy="yes"`}}
			ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: filters}}, nil
			})
			calls := 0
			lister := listerFunc(func(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
				require.Equal(t, namespace, k8srequest.NamespaceValue(ctx))
				requester, err := identity.GetRequester(ctx)
				require.NoError(t, err)
				require.True(t, requester.IsIdentityType(claims.TypeAccessPolicy))
				require.Equal(t, int64(common.MaxListLimit), options.Limit)
				require.Nil(t, options.LabelSelector)
				calls++
				switch calls {
				case 1:
					require.Empty(t, options.Continue)
					return &iamv0.TeamList{ListMeta: metav1.ListMeta{Continue: "opaque-cursor-1"}, Items: []iamv0.Team{*teamWithMembers("team-a", "user-a")}}, nil
				case 2:
					require.Equal(t, "opaque-cursor-1", options.Continue)
					// A page may be empty after authorization filtering and still
					// provide a cursor; the next page must still be visited.
					return &iamv0.TeamList{ListMeta: metav1.ListMeta{Continue: "opaque-cursor-2"}}, nil
				case 3:
					require.Equal(t, "opaque-cursor-2", options.Continue)
					team := teamWithMembers("team-b", "user-a")
					team.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: "42"} //nolint:staticcheck // legacy rule compatibility
					return &iamv0.TeamList{Items: []iamv0.Team{*team}}, nil
				default:
					t.Fatal("unexpected extra page")
					return nil, nil
				}
			})
			handler := NewRulesForSubjectREST(ruleGetter, lister, tracing.NewNoopTracerService(), prometheus.NewRegistry())
			response, outcome, err := handler.getRulesForUser(k8srequest.WithNamespace(t.Context(), namespace), "prometheus.datasource-a", "user-a")
			require.NoError(t, err)
			require.Equal(t, filters, response.TeamFilters)
			require.Equal(t, forSubjectOutcomeFiltersReturned, outcome)
			require.Equal(t, 3, calls)
			teamEvaluationMetric := &dto.Metric{}
			require.NoError(t, handler.metrics.teamEvaluationDurationSeconds.WithLabelValues("prometheus").(prometheus.Metric).Write(teamEvaluationMetric))
			require.Equal(t, uint64(1), teamEvaluationMetric.GetHistogram().GetSampleCount(), "one observation for the full evaluation, not per page")
			response.TeamFilters["team-a"][0] = "modified"
			require.Equal(t, `a="1"`, filters["team-a"][0], "returned filters must not alias stored rules")
		})
	}
}

func TestRulesForSubjectRESTTeamListErrorsReturnNoPartialPolicy(t *testing.T) {
	wantErr := apierrors.NewServiceUnavailable("team list failed")
	for _, tt := range []struct {
		name string
		page runtime.Object
		err  error
		want string
	}{
		{name: "later page error", err: wantErr, want: "team list failed"},
		{name: "nil list", want: "unexpected Team list object type"},
		{name: "typed nil list", page: (*iamv0.TeamList)(nil), want: "unexpected Team list object type"},
		{name: "wrong object", page: &iamv0.User{}, want: "unexpected Team list object type"},
		{name: "repeated cursor", page: &iamv0.TeamList{ListMeta: metav1.ListMeta{Continue: "next"}}, want: "repeated continue token"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{
					"team-a":       {`foo="bar"`},
					"missing-team": {`missing="uid"`},
					"42":           {`missing="numeric"`},
				}}}, nil
			})
			calls := 0
			lister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
				calls++
				if calls == 1 {
					return &iamv0.TeamList{ListMeta: metav1.ListMeta{Continue: "next"}, Items: []iamv0.Team{*teamWithMembers("team-a", "user-a")}}, nil
				}
				return tt.page, tt.err
			})
			handler := NewRulesForSubjectREST(ruleGetter, lister, tracing.NewNoopTracerService(), prometheus.NewRegistry())
			response, outcome, err := handler.getRulesForUser(t.Context(), "prometheus.datasource-a", "user-a")
			require.ErrorContains(t, err, tt.want)
			if tt.err != nil {
				require.ErrorIs(t, err, wantErr)
			}
			require.Nil(t, response)
			require.Empty(t, outcome)
			require.Equal(t, 2, calls)
			require.Zero(t, testutil.ToFloat64(handler.metrics.missingTeams), "incomplete listings must not count missing teams")
			require.Equal(t, float64(1), testutil.ToFloat64(handler.metrics.listedTeamsWithoutLegacyID), "count returned Teams even if a later page fails")
		})
	}
}

func TestRulesForSubjectRESTRejectsAmbiguousLegacyTeamIDsAcrossPages(t *testing.T) {
	ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{"42": {`foo="bar"`}}}}, nil
	})
	calls := 0
	lister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		calls++
		team := teamWithMembers(fmt.Sprintf("team-%d", calls), "other-user")
		if calls == 1 {
			team.Spec.Members = append(team.Spec.Members, iamv0.TeamTeamMember{Name: "user-a"})
		}
		team.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: "42"} //nolint:staticcheck // legacy rule compatibility
		page := &iamv0.TeamList{Items: []iamv0.Team{*team}}
		if calls == 1 {
			page.Continue = "next"
		}
		return page, nil
	})
	handler := NewRulesForSubjectREST(ruleGetter, lister, tracing.NewNoopTracerService(), nil)
	response, _, err := handler.getRulesForUser(t.Context(), "prometheus.datasource-a", "user-a")
	require.ErrorContains(t, err, "resolved to more than one team")
	require.Nil(t, response)
	require.Equal(t, 2, calls)
}

func TestRulesForSubjectRESTNumericKeysUseLegacyMetadata(t *testing.T) {
	for _, tt := range []struct {
		name string
		key  string
		id   string
		want bool
	}{
		{name: "numeric ID", key: "42", id: "42", want: true},
		{name: "leading zeros", key: "0042", id: "42", want: true},
		{name: "missing ID", key: "42"},
		{name: "malformed ID", key: "42", id: "invalid"},
		{name: "zero does not match missing ID", key: "0"},
		{name: "different ID", key: "42", id: "43"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{tt.key: {`foo="bar"`}}}}, nil
			})
			lister := listerFunc(func(_ context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
				require.Nil(t, options.LabelSelector, "unresolved numeric references must not trigger another lookup")
				// A numeric-looking UID must not match a numeric legacy rule key.
				team := teamWithMembers(tt.key, "user-a")
				team.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: tt.id} //nolint:staticcheck // legacy rule compatibility
				return &iamv0.TeamList{Items: []iamv0.Team{*team}}, nil
			})
			handler := NewRulesForSubjectREST(ruleGetter, lister, tracing.NewNoopTracerService(), nil)
			response, _, err := handler.getRulesForUser(t.Context(), "prometheus.datasource-a", "user-a")
			require.NoError(t, err)
			if tt.want {
				require.Equal(t, map[string][]string{tt.key: {`foo="bar"`}}, response.TeamFilters)
			} else {
				require.Empty(t, response.TeamFilters)
			}
		})
	}
}

func TestRulesForSubjectRESTMissingTeamsAfterCompleteListing(t *testing.T) {
	for _, userUID := range []string{"user-a", "non-member"} {
		t.Run(userUID, func(t *testing.T) {
			ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{
					"team-a":       {`foo="a"`},
					"team-b":       {`foo="b"`},
					"42":           {},
					"0042":         {`legacy="yes"`},
					"missing-team": {`missing="uid"`},
					"43":           {`missing="numeric"`},
				}}}, nil
			})
			var handler *RulesForSubjectREST
			calls := 0
			lister := listerFunc(func(_ context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
				require.Nil(t, options.LabelSelector, "unresolved numeric references must not trigger another lookup")
				calls++
				require.Zero(t, testutil.ToFloat64(handler.metrics.missingTeams), "do not count before all pages are read")
				if calls == 1 {
					require.Empty(t, options.Continue)
					return &iamv0.TeamList{ListMeta: metav1.ListMeta{Continue: "next"}, Items: []iamv0.Team{*teamWithMembers("team-a", "user-a")}}, nil
				}
				require.Equal(t, 2, calls)
				require.Equal(t, "next", options.Continue)
				team := teamWithMembers("team-b", "another-user")
				team.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: "42"} //nolint:staticcheck // legacy rule compatibility
				return &iamv0.TeamList{Items: []iamv0.Team{*team}}, nil
			})
			handler = NewRulesForSubjectREST(ruleGetter, lister, tracing.NewNoopTracerService(), prometheus.NewRegistry())
			response, _, err := handler.getRulesForUser(t.Context(), "prometheus.datasource-a", userUID)
			require.NoError(t, err)
			require.Equal(t, 2, calls)
			require.Equal(t, float64(2), testutil.ToFloat64(handler.metrics.missingTeams), "only missing-team and numeric ID 43 are unresolved")
			if userUID == "user-a" {
				require.Equal(t, map[string][]string{"team-a": {`foo="a"`}}, response.TeamFilters)
			} else {
				require.Empty(t, response.TeamFilters)
			}
		})
	}
}

func TestRulesForSubjectRESTCountsListedTeamsWithoutLegacyIDs(t *testing.T) {
	for _, namespace := range []string{"org-1", "stacks-27821"} {
		for _, ruleTeamKey := range []string{"team-a", "42"} {
			t.Run(namespace+"/"+ruleTeamKey, func(t *testing.T) {
				filters := map[string][]string{ruleTeamKey: {`foo="bar"`}}
				ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
					return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: filters}}, nil
				})
				team := teamWithMembers("team-a", "user-a")
				team.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: "42"} //nolint:staticcheck // legacy rule compatibility
				malformed := teamWithMembers("unrelated-team", "user-a")
				malformed.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: "invalid"} //nolint:staticcheck // observe malformed legacy IDs
				calls := 0
				lister := listerFunc(func(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
					require.Equal(t, namespace, k8srequest.NamespaceValue(ctx))
					require.Nil(t, options.LabelSelector)
					calls++
					if options.Continue == "" {
						return &iamv0.TeamList{ListMeta: metav1.ListMeta{Continue: "next"}, Items: []iamv0.Team{
							*team, *teamWithMembers("non-member-team", "other-user"),
						}}, nil
					}
					require.Equal(t, "next", options.Continue)
					return &iamv0.TeamList{Items: []iamv0.Team{*malformed}}, nil
				})
				handler := NewRulesForSubjectREST(ruleGetter, lister, tracing.NewNoopTracerService(), prometheus.NewRegistry())
				for request := 1; request <= 2; request++ {
					response, outcome, err := handler.getRulesForUser(k8srequest.WithNamespace(t.Context(), namespace), "prometheus.datasource-a", "user-a")
					require.NoError(t, err)
					require.Equal(t, filters, response.TeamFilters)
					require.Equal(t, forSubjectOutcomeFiltersReturned, outcome)
					require.Equal(t, 2*request, calls)
					require.Equal(t, float64(2*request), testutil.ToFloat64(handler.metrics.listedTeamsWithoutLegacyID), "count observations across pages and requests, not unique Teams or only matching Teams")
					require.Zero(t, testutil.ToFloat64(handler.metrics.missingTeams))
				}
			})
		}
	}
}

func TestRulesForSubjectRESTMetrics(t *testing.T) {
	tests := []struct {
		name                  string
		ruleGetter            getterFunc
		teamLister            listerFunc
		parts                 []string
		outcome               string
		errorClass            string
		missingTeams          float64
		teamEvaluationSamples uint64
	}{
		{
			name: "no stored rule", outcome: "no_rules", errorClass: "none",
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return nil, apierrors.NewNotFound(iamv0.TeamLBACRuleInfo.GroupResource(), "prometheus.datasource-a")
			},
		},
		{
			name: "empty stored rule", outcome: "empty_rule", errorClass: "none",
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{}, nil
			},
		},
		{
			name: "filters returned", outcome: "filters_returned", errorClass: "none",
			teamEvaluationSamples: 1,
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{"team-a": {`foo="bar"`}}}}, nil
			},
			teamLister: func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
				return &iamv0.TeamList{Items: []iamv0.Team{*teamWithMembers("team-a", "user-a")}}, nil
			},
		},
		{
			name: "no applicable team", outcome: "no_team_membership", errorClass: "none",
			teamEvaluationSamples: 1,
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{"team-a": {`foo="bar"`}}}}, nil
			},
			teamLister: func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
				return &iamv0.TeamList{Items: []iamv0.Team{*teamWithMembers("team-a", "other-user")}}, nil
			},
		},
		{
			name: "missing team", outcome: "no_team_membership", errorClass: "none", missingTeams: 1,
			teamEvaluationSamples: 1,
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{"team-a": {`foo="bar"`}}}}, nil
			},
			teamLister: func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
				return &iamv0.TeamList{}, nil
			},
		},
		{
			name: "empty filters for member", outcome: "no_applicable_filters", errorClass: "none",
			teamEvaluationSamples: 1,
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{"team-a": {}}}}, nil
			},
			teamLister: func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
				return &iamv0.TeamList{Items: []iamv0.Team{*teamWithMembers("team-a", "user-a")}}, nil
			},
		},
		{
			name: "Team lookup unavailable", outcome: "error", errorClass: "unavailable", teamEvaluationSamples: 1,
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{"team-a": {`foo="bar"`}}}}, nil
			},
			teamLister: func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
				return nil, apierrors.NewServiceUnavailable("Team lookup unavailable")
			},
		},
		{
			name: "Team lookup canceled", outcome: "error", errorClass: "canceled", teamEvaluationSamples: 1,
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{TeamFilters: map[string][]string{"team-a": {`foo="bar"`}}}}, nil
			},
			teamLister: func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
				return nil, context.Canceled
			},
		},
		{
			name: "storage unavailable", outcome: "error", errorClass: "unavailable",
			ruleGetter: func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return nil, apierrors.NewServiceUnavailable("storage unavailable")
			},
		},
		{
			name: "invalid subject", outcome: "rejected", errorClass: "bad_request",
			parts: subjectRequestParts("service-account", "service-a"),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			ruleGetter := tt.ruleGetter
			if ruleGetter == nil {
				ruleGetter = func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
					t.Fatal("storage should not be called")
					return nil, nil
				}
			}
			teamLister := tt.teamLister
			if teamLister == nil {
				teamLister = func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
					t.Fatal("team lister should not be called")
					return nil, nil
				}
			}
			handler := NewRulesForSubjectREST(ruleGetter, teamLister, tracing.NewNoopTracerService(), reg)
			responder := &testResponder{}
			httpHandler, err := handler.Connect(context.Background(), "prometheus.datasource-a", nil, responder)
			require.NoError(t, err)
			parts := tt.parts
			if parts == nil {
				parts = subjectRequestParts("user", "user-a")
			}
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "org-1"})
			ctx = k8srequest.WithRequestInfo(ctx, &k8srequest.RequestInfo{Parts: parts})
			httpHandler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx))
			require.Equal(t, float64(1), testutil.ToFloat64(handler.metrics.requestsTotal.WithLabelValues(tt.outcome, tt.errorClass, "prometheus")))
			durationMetric := &dto.Metric{}
			require.NoError(t, handler.metrics.durationSeconds.WithLabelValues(tt.outcome, tt.errorClass, "prometheus").(prometheus.Metric).Write(durationMetric))
			require.Equal(t, uint64(1), durationMetric.GetHistogram().GetSampleCount())
			teamEvaluationMetric := &dto.Metric{}
			require.NoError(t, handler.metrics.teamEvaluationDurationSeconds.WithLabelValues("prometheus").(prometheus.Metric).Write(teamEvaluationMetric))
			require.Equal(t, tt.teamEvaluationSamples, teamEvaluationMetric.GetHistogram().GetSampleCount())
			require.Equal(t, tt.missingTeams, testutil.ToFloat64(handler.metrics.missingTeams))
		})
	}
}

func subjectRequestParts(subjectType, subjectUID string) []string {
	return []string{"teamlbacrules", "prometheus.datasource-a", "for-subject", subjectType, subjectUID}
}

func teamWithMembers(name string, members ...string) *iamv0.Team {
	team := &iamv0.Team{ObjectMeta: metav1.ObjectMeta{Name: name}}
	for _, member := range members {
		team.Spec.Members = append(team.Spec.Members, iamv0.TeamTeamMember{Name: member})
	}
	return team
}

var _ rest.Responder = (*testResponder)(nil)

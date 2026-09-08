package teamlbac

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
	teamGetter := getterFunc(func(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
		requester, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.True(t, requester.IsIdentityType(claims.TypeAccessPolicy))

		switch name {
		case "team-a":
			return teamWithMembers(name, "user-a"), nil
		case "team-b":
			return teamWithMembers(name, "another-user"), nil
		default:
			return nil, apierrors.NewNotFound(iamv0.TeamResourceInfo.GroupResource(), name)
		}
	})
	teamLister := listerFunc(func(_ context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
		require.Equal(t, int64(2), options.Limit)
		require.True(t, options.LabelSelector.Matches(labels.Set{
			apiutils.LabelKeyDeprecatedInternalID: "42", //nolint:staticcheck // compatibility for pre-normalization TeamLBACRules
		}))
		return &iamv0.TeamList{Items: []iamv0.Team{*teamWithMembers("team-old", "user-a")}}, nil
	})

	handler := NewRulesForSubjectREST(ruleGetter, teamGetter, teamLister, tracing.NewNoopTracerService())
	response, err := handler.getRulesForUser(context.Background(), "prometheus.datasource-a", "user-a")
	require.NoError(t, err)
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
	teamGetter := getterFunc(func(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
		return nil, apierrors.NewNotFound(iamv0.TeamResourceInfo.GroupResource(), name)
	})
	teamLister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		return &iamv0.TeamList{}, nil
	})

	handler := NewRulesForSubjectREST(ruleGetter, teamGetter, teamLister, tracing.NewNoopTracerService())
	response, err := handler.getRulesForUser(context.Background(), "prometheus.datasource-a", "user-a")
	require.NoError(t, err)
	require.Empty(t, response.TeamFilters)
}

func TestRulesForSubjectRESTPropagatesRuleReadErrors(t *testing.T) {
	wantErr := errors.New("rule read failed")
	ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		return nil, wantErr
	})
	unusedGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		t.Fatal("team getter should not be called")
		return nil, nil
	})
	unusedLister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		t.Fatal("team lister should not be called")
		return nil, nil
	})

	handler := NewRulesForSubjectREST(ruleGetter, unusedGetter, unusedLister, tracing.NewNoopTracerService())
	response, err := handler.getRulesForUser(context.Background(), "prometheus.datasource-a", "user-a")
	require.ErrorIs(t, err, wantErr)
	require.Nil(t, response)
}

func TestRulesForSubjectRESTConnectReturnsEmptyRulesWhenRuleDoesNotExist(t *testing.T) {
	ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		return nil, apierrors.NewNotFound(iamv0.TeamLBACRuleInfo.GroupResource(), "prometheus.datasource-a")
	})
	unusedGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
		t.Fatal("team getter should not be called")
		return nil, nil
	})
	unusedLister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		t.Fatal("team lister should not be called")
		return nil, nil
	})
	handler := NewRulesForSubjectREST(ruleGetter, unusedGetter, unusedLister, tracing.NewNoopTracerService())
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
	handler := NewRulesForSubjectREST(unusedGetter, unusedGetter, unusedLister, tracing.NewNoopTracerService())

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
	teamGetter := getterFunc(func(ctx context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
		require.Equal(t, "org-1", k8srequest.NamespaceValue(ctx))
		requester, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.True(t, requester.IsIdentityType(claims.TypeAccessPolicy))
		return teamWithMembers("team-a", "user-a"), nil
	})
	unusedLister := listerFunc(func(context.Context, *metainternalversion.ListOptions) (runtime.Object, error) {
		t.Fatal("numeric team lister should not be called")
		return nil, nil
	})
	handler := NewRulesForSubjectREST(ruleGetter, teamGetter, unusedLister, tracing.NewNoopTracerService())
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

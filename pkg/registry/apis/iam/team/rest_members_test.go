package team

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestTeamMembersREST_Connect(t *testing.T) {
	features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings)

	t.Run("returns members from team spec", func(t *testing.T) {
		g := &mockGetter{team: teamWithMembers("team1",
			member("user1", "admin", true),
			member("user2", "member", false),
		)}
		handler := NewTeamMembersREST(g, tracing.NewNoopTracerService(), features)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
		responder := &mockResponder{}

		h, err := handler.Connect(ctx, "team1", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members", nil).WithContext(ctx)
		h.ServeHTTP(httptest.NewRecorder(), req)

		require.True(t, responder.called)
		require.NoError(t, responder.err)
		resp := responder.obj.(*iamv0alpha1.GetTeamMembersResponse)
		require.Len(t, resp.Items, 2)
		require.Equal(t, "user1", resp.Items[0].User)
		require.Equal(t, "team1", resp.Items[0].Team)
		require.Equal(t, "admin", resp.Items[0].Permission)
		require.True(t, resp.Items[0].External)
		require.Equal(t, "user2", resp.Items[1].User)
		require.Equal(t, "member", resp.Items[1].Permission)
		require.False(t, resp.Items[1].External)
	})

	t.Run("returns 403 when feature flag disabled", func(t *testing.T) {
		g := &mockGetter{team: teamWithMembers("team1")}
		handler := NewTeamMembersREST(g, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
		responder := &mockResponder{}

		h, _ := handler.Connect(ctx, "team1", nil, responder)
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/members", nil).WithContext(ctx))

		require.True(t, responder.called)
		require.Error(t, responder.err)
		var se *apierrors.StatusError
		require.ErrorAs(t, responder.err, &se)
		require.Equal(t, int32(http.StatusForbidden), se.ErrStatus.Code)
	})

	t.Run("propagates getter error", func(t *testing.T) {
		g := &mockGetter{err: errors.New("boom")}
		handler := NewTeamMembersREST(g, tracing.NewNoopTracerService(), features)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
		responder := &mockResponder{}

		h, _ := handler.Connect(ctx, "team1", nil, responder)
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/members", nil).WithContext(ctx))

		require.True(t, responder.called)
		require.EqualError(t, responder.err, "boom")
	})

	t.Run("paginates via limit and offset", func(t *testing.T) {
		g := &mockGetter{team: teamWithMembers("team1",
			member("u1", "member", false),
			member("u2", "member", false),
			member("u3", "member", false),
			member("u4", "member", false),
		)}
		handler := NewTeamMembersREST(g, tracing.NewNoopTracerService(), features)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
		responder := &mockResponder{}

		h, _ := handler.Connect(ctx, "team1", nil, responder)
		req := httptest.NewRequest(http.MethodGet, "/members?limit=2&offset=1", nil).WithContext(ctx)
		h.ServeHTTP(httptest.NewRecorder(), req)

		resp := responder.obj.(*iamv0alpha1.GetTeamMembersResponse)
		require.Len(t, resp.Items, 2)
		require.Equal(t, "u2", resp.Items[0].User)
		require.Equal(t, "u3", resp.Items[1].User)
	})

	t.Run("paginates via page + limit", func(t *testing.T) {
		g := &mockGetter{team: teamWithMembers("team1",
			member("u1", "member", false),
			member("u2", "member", false),
			member("u3", "member", false),
			member("u4", "member", false),
		)}
		handler := NewTeamMembersREST(g, tracing.NewNoopTracerService(), features)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
		responder := &mockResponder{}

		h, _ := handler.Connect(ctx, "team1", nil, responder)
		req := httptest.NewRequest(http.MethodGet, "/members?limit=2&page=2", nil).WithContext(ctx)
		h.ServeHTTP(httptest.NewRecorder(), req)

		resp := responder.obj.(*iamv0alpha1.GetTeamMembersResponse)
		require.Len(t, resp.Items, 2)
		require.Equal(t, "u3", resp.Items[0].User)
		require.Equal(t, "u4", resp.Items[1].User)
	})

	t.Run("clamps negative offset to zero", func(t *testing.T) {
		g := &mockGetter{team: teamWithMembers("team1",
			member("u1", "member", false),
			member("u2", "member", false),
		)}
		handler := NewTeamMembersREST(g, tracing.NewNoopTracerService(), features)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
		responder := &mockResponder{}

		h, _ := handler.Connect(ctx, "team1", nil, responder)
		req := httptest.NewRequest(http.MethodGet, "/members?limit=2&offset=-1", nil).WithContext(ctx)
		h.ServeHTTP(httptest.NewRecorder(), req)

		require.True(t, responder.called)
		require.NoError(t, responder.err)
		resp := responder.obj.(*iamv0alpha1.GetTeamMembersResponse)
		require.Len(t, resp.Items, 2)
		require.Equal(t, "u1", resp.Items[0].User)
		require.Equal(t, "u2", resp.Items[1].User)
	})

	t.Run("clamps negative page to zero offset", func(t *testing.T) {
		g := &mockGetter{team: teamWithMembers("team1",
			member("u1", "member", false),
			member("u2", "member", false),
		)}
		handler := NewTeamMembersREST(g, tracing.NewNoopTracerService(), features)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
		responder := &mockResponder{}

		h, _ := handler.Connect(ctx, "team1", nil, responder)
		req := httptest.NewRequest(http.MethodGet, "/members?limit=2&page=-1", nil).WithContext(ctx)
		h.ServeHTTP(httptest.NewRecorder(), req)

		require.True(t, responder.called)
		require.NoError(t, responder.err)
		resp := responder.obj.(*iamv0alpha1.GetTeamMembersResponse)
		require.Len(t, resp.Items, 2)
		require.Equal(t, "u1", resp.Items[0].User)
		require.Equal(t, "u2", resp.Items[1].User)
	})

	t.Run("rejects limit above max", func(t *testing.T) {
		g := &mockGetter{team: teamWithMembers("team1")}
		handler := NewTeamMembersREST(g, tracing.NewNoopTracerService(), features)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
		h, _ := handler.Connect(ctx, "team1", nil, &mockResponder{})
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/members?limit=999999", nil).WithContext(ctx)
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func teamWithMembers(name string, members ...iamv0alpha1.TeamTeamMember) *iamv0alpha1.Team {
	return &iamv0alpha1.Team{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Spec:       iamv0alpha1.TeamSpec{Title: "t", Members: members},
	}
}

func member(name, permission string, external bool) iamv0alpha1.TeamTeamMember {
	return iamv0alpha1.TeamTeamMember{
		Kind:       "User",
		Name:       name,
		Permission: iamv0alpha1.TeamTeamPermission(permission),
		External:   external,
	}
}

type mockResponder struct {
	called bool
	err    error
	obj    interface{}
	code   int
}

func (m *mockResponder) Object(statusCode int, obj runtime.Object) {
	m.called = true
	m.code = statusCode
	m.obj = obj
}

func (m *mockResponder) Error(err error) {
	m.called = true
	m.err = err
}

type mockGetter struct {
	team *iamv0alpha1.Team
	err  error
}

func (m *mockGetter) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.team, nil
}

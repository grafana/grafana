package user

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestUserTeamRESTQuery(t *testing.T) {
	token, err := resource.NewSearchContinueToken([]string{"team-a"}, 42)
	require.NoError(t, err)
	for _, tt := range []struct {
		params  string
		limit   int64
		after   []string
		explain bool
	}{
		{limit: common.DefaultListLimit},
		{params: "limit=20", limit: 20},
		{params: "limit=0", limit: common.DefaultListLimit},
		{params: "limit=-1", limit: common.DefaultListLimit},
		{params: "limit=invalid", limit: common.DefaultListLimit},
		{params: "continue=" + url.QueryEscape(token), limit: common.DefaultListLimit, after: []string{"team-a"}},
		{params: "explain=true", limit: common.DefaultListLimit, explain: true},
		{params: "explain", limit: common.DefaultListLimit, explain: true},
		{params: "explain=false", limit: common.DefaultListLimit},
		{params: "offset=10&page=3", limit: common.DefaultListLimit},
	} {
		t.Run(tt.params, func(t *testing.T) {
			backend := &fakeUserTeamsBackend{}
			requester := &identity.StaticRequester{Namespace: "stacks-1"}
			ctx := identity.WithRequester(t.Context(), requester)
			responder, w := serveUserTeams(t, ctx, userTeamsSelector(backend), tt.params)
			require.NoError(t, responder.err)
			require.Equal(t, http.StatusOK, w.Code)
			require.Equal(t, UserTeamsQuery{Namespace: "stacks-1", UserUID: "alice", Limit: tt.limit, After: tt.after, Explain: tt.explain}, backend.queries[0])
			got, err := identity.GetRequester(backend.ctx)
			require.NoError(t, err)
			require.Same(t, requester, got)
		})
	}
}

func TestUserTeamRESTResponse(t *testing.T) {
	for _, tt := range []struct {
		name string
		page UserTeamsPage
	}{
		{name: "empty"},
		{name: "partial page", page: UserTeamsPage{Items: []iamv0.GetUserTeamsUserTeam{{User: "alice", Team: "team-a", Permission: "admin", External: true}}}},
		{name: "full page", page: UserTeamsPage{Items: []iamv0.GetUserTeamsUserTeam{{User: "alice", Team: "team-a"}}, Next: []string{"team-a"}, ResourceVersion: 42}},
		{name: "all visited memberships disappeared", page: UserTeamsPage{Items: []iamv0.GetUserTeamsUserTeam{}, Next: []string{"team-b"}, ResourceVersion: 43}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			backend := &fakeUserTeamsBackend{page: &tt.page}
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Namespace: "stacks-1"})
			responder, _ := serveUserTeams(t, ctx, userTeamsSelector(backend), "")
			require.NoError(t, responder.err)
			require.Equal(t, http.StatusOK, responder.code)
			result := responder.obj.(*iamv0.GetUserTeamsResponse)
			require.Equal(t, tt.page.Items, result.Items)
			if len(tt.page.Next) == 0 {
				require.Empty(t, result.Continue)
			} else {
				token, err := resource.GetContinueToken(result.Continue)
				require.NoError(t, err)
				require.Equal(t, tt.page.Next, token.SearchAfter)
				require.Equal(t, tt.page.ResourceVersion, token.ResourceVersion)
			}
		})
	}
}

func TestUserTeamRESTInvalidRequest(t *testing.T) {
	for _, tt := range []struct {
		name       string
		params     string
		noIdentity bool
	}{
		{name: "bad token", params: "continue=not-base64!"},
		{name: "large limit", params: fmt.Sprintf("limit=%d", common.MaxListLimit+1)},
		{name: "bad query", params: "invalid=%zz"},
		{name: "missing identity", noIdentity: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			backend := &fakeUserTeamsBackend{}
			ctx := t.Context()
			if !tt.noIdentity {
				ctx = identity.WithRequester(ctx, &identity.StaticRequester{Namespace: "stacks-1"})
			}
			responder, w := serveUserTeams(t, ctx, userTeamsSelector(backend), tt.params)
			require.Empty(t, backend.queries)
			switch {
			case tt.noIdentity:
				require.True(t, apierrors.IsUnauthorized(responder.err))
			case tt.name == "bad query":
				require.Error(t, responder.err)
			default:
				require.Equal(t, http.StatusBadRequest, w.Code)
			}
		})
	}
}

func TestUserTeamRESTModeChanges(t *testing.T) {
	gr := iamv0.TeamResourceInfo.GroupResource()
	cfg := &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{
		iamv0.UserResourceInfo.GroupResource().String(): {DualWriterMode: rest.Mode5},
	}}
	legacyBackend := &fakeUserTeamsBackend{page: &UserTeamsPage{Items: []iamv0.GetUserTeamsUserTeam{{Team: "legacy"}}}}
	unifiedBackend := &fakeUserTeamsBackend{page: &UserTeamsPage{Items: []iamv0.GetUserTeamsUserTeam{{Team: "unified"}}}}
	selector := dualwrite.NewSelector[UserTeamsBackend](dualwrite.ProvideServiceForTests(cfg), gr, legacyBackend, unifiedBackend)
	handler := NewUserTeamREST(selector, tracing.NewNoopTracerService())
	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Namespace: "stacks-1"})
	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5, rest.Mode0} {
		cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: mode}
		responder := &mockResponder{}
		h, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/teams", nil).WithContext(ctx))
		require.NoError(t, responder.err)
		want := "legacy"
		if mode >= rest.Mode4 {
			want = "unified"
		}
		require.Equal(t, want, responder.obj.(*iamv0.GetUserTeamsResponse).Items[0].Team)
	}
	require.Len(t, legacyBackend.queries, 5)
	require.Len(t, unifiedBackend.queries, 2)
}

func TestUserTeamRESTErrorsDoNotFallback(t *testing.T) {
	for _, tt := range []struct {
		name           string
		unified        bool
		selectionError bool
	}{
		{name: "selection", selectionError: true},
		{name: "legacy error"},
		{name: "unified error", unified: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			wantErr := errors.New("unavailable")
			legacyBackend := &fakeUserTeamsBackend{err: wantErr}
			unifiedBackend := &fakeUserTeamsBackend{err: wantErr}
			reader := userReadModeFunc(func(_ context.Context, gr schema.GroupResource) (bool, error) {
				require.Equal(t, iamv0.TeamResourceInfo.GroupResource(), gr)
				if tt.selectionError {
					return false, wantErr
				}
				return tt.unified, nil
			})
			selector := dualwrite.NewSelector[UserTeamsBackend](reader, iamv0.TeamResourceInfo.GroupResource(), legacyBackend, unifiedBackend)
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Namespace: "stacks-1"})
			responder, _ := serveUserTeams(t, ctx, selector, "")
			if tt.selectionError {
				require.True(t, apierrors.IsInternalError(responder.err))
				require.ErrorContains(t, responder.err, wantErr.Error())
			} else {
				require.ErrorIs(t, responder.err, wantErr)
			}
			require.Equal(t, !tt.selectionError && !tt.unified, len(legacyBackend.queries) > 0)
			require.Equal(t, !tt.selectionError && tt.unified, len(unifiedBackend.queries) > 0)
		})
	}
}

func serveUserTeams(t *testing.T, ctx context.Context, selector *dualwrite.Selector[UserTeamsBackend], params string) (*mockResponder, *httptest.ResponseRecorder) {
	t.Helper()
	handler := NewUserTeamREST(selector, tracing.NewNoopTracerService())
	responder := &mockResponder{}
	h, err := handler.Connect(ctx, "alice", nil, responder)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/teams?"+params, nil).WithContext(ctx))
	return responder, w
}

func userTeamsSelector(backend UserTeamsBackend) *dualwrite.Selector[UserTeamsBackend] {
	return dualwrite.NewSelector(dualwrite.ProvideServiceForTests(&setting.Cfg{}), iamv0.TeamResourceInfo.GroupResource(), backend, backend)
}

type fakeUserTeamsBackend struct {
	queries []UserTeamsQuery
	ctx     context.Context
	page    *UserTeamsPage
	err     error
}

func (f *fakeUserTeamsBackend) ListUserTeams(ctx context.Context, query UserTeamsQuery) (*UserTeamsPage, error) {
	f.ctx = ctx
	f.queries = append(f.queries, query)
	if f.page != nil {
		return f.page, f.err
	}
	return &UserTeamsPage{}, f.err
}

type mockResponder struct {
	err  error
	obj  runtime.Object
	code int
}

func (m *mockResponder) Object(code int, obj runtime.Object) { m.code, m.obj = code, obj }
func (m *mockResponder) Error(err error)                     { m.err = err }

package user

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	legacyuser "github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func TestUserSearchModeChanges(t *testing.T) {
	gr := iamv0.UserResourceInfo.GroupResource()
	cfg := &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{}}
	var calls []string
	backend := func(name string) SearchBackend {
		return &fakeSearchBackend{SearchFunc: func(_ context.Context, query SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
			calls = append(calls, name)
			require.Equal(t, "stacks-1", query.Namespace)
			require.Equal(t, "a*b", query.Query, "the handler must pass literal user input")
			return &iamv0.GetSearchUsersResponse{TotalHits: 1, Hits: []iamv0.GetSearchUsersUserHit{{Name: name}}}, nil
		}}
	}
	selector := dualwrite.NewSelector(dualwrite.ProvideServiceForTests(cfg), gr, backend("legacy"), backend("unified"))
	handler := NewSearchHandler(tracing.NewNoopTracerService(), selector, nil)

	for _, tt := range []struct {
		mode rest.DualWriterMode
		want string
	}{
		{rest.Mode0, "legacy"},
		{rest.Mode5, "unified"},
		{rest.Mode0, "legacy"},
	} {
		cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: tt.mode}
		req := httptest.NewRequest("GET", "/searchUsers?query=a*b", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &legacyuser.SignedInUser{Namespace: "stacks-1"}))
		w := httptest.NewRecorder()

		handler.DoSearch(w, req)

		require.Equal(t, 200, w.Code)
		var result iamv0.GetSearchUsersResponse
		require.NoError(t, json.NewDecoder(w.Body).Decode(&result))
		require.Len(t, result.Hits, 1)
		require.Equal(t, tt.want, result.Hits[0].Name)
	}
	require.Equal(t, []string{"legacy", "unified", "legacy"}, calls)
}

func TestUserSearchPagination(t *testing.T) {
	for _, tt := range []struct {
		url    string
		page   int64
		offset int64
	}{
		{url: "/searchUsers?limit=10", page: 1},
		{url: "/searchUsers?limit=10&page=3", page: 3, offset: 20},
		{url: "/searchUsers?limit=10&offset=15&page=4", page: 2, offset: 15},
	} {
		t.Run(tt.url, func(t *testing.T) {
			var got SearchQuery
			backend := &fakeSearchBackend{SearchFunc: func(_ context.Context, query SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
				got = query
				return iamv0.NewGetSearchUsersResponse(), nil
			}}
			handler := NewSearchHandler(tracing.NewNoopTracerService(), selectorForBackend(backend), nil)
			req := httptest.NewRequest("GET", tt.url, nil)
			req = req.WithContext(identity.WithRequester(req.Context(), &legacyuser.SignedInUser{Namespace: "stacks-1"}))
			w := httptest.NewRecorder()

			handler.DoSearch(w, req)

			require.Equal(t, 200, w.Code)
			require.Equal(t, int64(10), got.Limit)
			require.Equal(t, tt.page, got.Page)
			require.Equal(t, tt.offset, got.Offset)
			require.Equal(t, []string{"login"}, got.Sort)
		})
	}
}

func TestUserValidationModeChanges(t *testing.T) {
	gr := iamv0.UserResourceInfo.GroupResource()
	cfg := &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{}}
	var calls []string
	backend := func(name string) SearchBackend {
		return &fakeSearchBackend{SearchFunc: func(_ context.Context, query SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
			calls = append(calls, name)
			require.Equal(t, "stacks-1", query.Namespace)
			require.True(t, query.Email != nil || query.Login != nil)
			return iamv0.NewGetSearchUsersResponse(), nil
		}}
	}
	selector := dualwrite.NewSelector(dualwrite.ProvideServiceForTests(cfg), gr, backend("legacy"), backend("unified"))
	ctx := identity.WithRequester(t.Context(), &legacyuser.SignedInUser{Namespace: "stacks-1", IsGrafanaAdmin: true})
	obj := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "user-1"}, Spec: iamv0.UserSpec{Login: "user", Email: "user@example.com", Role: "Viewer"}}

	require.NoError(t, ValidateOnCreate(ctx, selector, obj))
	cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: rest.Mode5}
	require.NoError(t, ValidateOnCreate(ctx, selector, obj))
	updated := obj.DeepCopy()
	updated.Spec.Login = "updated"
	updated.Spec.Email = "updated@example.com"
	require.NoError(t, ValidateOnUpdate(ctx, selector, obj, updated))

	require.Equal(t, []string{"legacy", "legacy", "unified", "unified", "unified", "unified"}, calls)
}

type userReadModeFunc func(context.Context, schema.GroupResource) (bool, error)

func (f userReadModeFunc) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	return f(ctx, gr)
}

func TestUserSearchSelectionError(t *testing.T) {
	wantErr := errors.New("mode unavailable")
	reader := userReadModeFunc(func(context.Context, schema.GroupResource) (bool, error) { return false, wantErr })
	backend := &fakeSearchBackend{SearchFunc: func(context.Context, SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
		t.Fatal("must not search after a selection error")
		return nil, nil
	}}
	selector := dualwrite.NewSelector[SearchBackend](reader, iamv0.UserResourceInfo.GroupResource(), backend, backend)
	handler := NewSearchHandler(tracing.NewNoopTracerService(), selector, nil)
	ctx := identity.WithRequester(t.Context(), &legacyuser.SignedInUser{Namespace: "stacks-1", IsGrafanaAdmin: true})
	req := httptest.NewRequest("GET", "/searchUsers", nil).WithContext(ctx)
	w := httptest.NewRecorder()

	handler.DoSearch(w, req)

	require.Equal(t, 500, w.Code)
	obj := &iamv0.User{Spec: iamv0.UserSpec{Login: "user", Role: "Viewer"}}
	require.ErrorIs(t, ValidateOnCreate(ctx, selector, obj), wantErr)
	updated := obj.DeepCopy()
	updated.Spec.Login = "changed"
	require.ErrorIs(t, ValidateOnUpdate(ctx, selector, obj, updated), wantErr)
	require.NoError(t, ValidateOnUpdate(ctx, selector, obj, obj), "unchanged login and email need no search")
}

func TestUserSearchDoesNotFallback(t *testing.T) {
	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode5} {
		cfg := &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{
			iamv0.UserResourceInfo.GroupResource().String(): {DualWriterMode: mode},
		}}
		var legacyCalls, unifiedCalls int
		backend := func(calls *int) SearchBackend {
			return &fakeSearchBackend{SearchFunc: func(context.Context, SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
				*calls++
				return nil, errors.New("search unavailable")
			}}
		}
		selector := dualwrite.NewSelector(dualwrite.ProvideServiceForTests(cfg), iamv0.UserResourceInfo.GroupResource(), backend(&legacyCalls), backend(&unifiedCalls))
		handler := NewSearchHandler(tracing.NewNoopTracerService(), selector, nil)
		req := httptest.NewRequest("GET", "/searchUsers", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &legacyuser.SignedInUser{Namespace: "stacks-1"}))
		w := httptest.NewRecorder()

		handler.DoSearch(w, req)

		require.Equal(t, 500, w.Code)
		if mode == rest.Mode0 {
			require.Equal(t, 1, legacyCalls)
			require.Zero(t, unifiedCalls)
		} else {
			require.Equal(t, 1, unifiedCalls)
			require.Zero(t, legacyCalls)
		}
	}
}

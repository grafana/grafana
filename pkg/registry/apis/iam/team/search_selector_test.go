package team

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func TestTeamSearchModeChanges(t *testing.T) {
	gr := iamv0.TeamResourceInfo.GroupResource()
	cfg := &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{}}
	var calls []string
	backend := func(name string) SearchBackend {
		return &fakeSearchBackend{searchFunc: func(_ context.Context, query SearchQuery) (*iamv0.GetSearchTeamsResponse, error) {
			calls = append(calls, name)
			require.Equal(t, "stacks-1", query.Namespace)
			return &iamv0.GetSearchTeamsResponse{GetSearchTeamsBody: iamv0.GetSearchTeamsBody{Hits: []iamv0.GetSearchTeamsTeamHit{{Name: name}}}}, nil
		}}
	}
	selector := dualwrite.NewSelector(dualwrite.ProvideServiceForTests(cfg), gr, backend("legacy"), backend("unified"))
	handler := NewSearchHandler(tracing.NewNoopTracerService(), selector, nil)
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "stacks-1"})
	obj := &iamv0.Team{ObjectMeta: metav1.ObjectMeta{Name: "legacy"}, Spec: iamv0.TeamSpec{Title: "Team"}}
	for _, tt := range []struct {
		mode rest.DualWriterMode
		want string
	}{
		{rest.Mode0, "legacy"},
		{rest.Mode5, "unified"},
		{rest.Mode0, "legacy"},
	} {
		cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: tt.mode}
		req := httptest.NewRequest("GET", "/searchTeams?query=test", nil).WithContext(ctx)
		w := httptest.NewRecorder()
		handler.DoTeamSearch(w, req)
		require.Equal(t, 200, w.Code)
		var result iamv0.GetSearchTeamsResponse
		require.NoError(t, json.NewDecoder(w.Body).Decode(&result))
		require.Len(t, result.Hits, 1)
		require.Equal(t, tt.want, result.Hits[0].Name)

		obj.Name = tt.want
		require.NoError(t, ValidateOnCreate(ctx, selector, obj, legacy.NoopExternalGroupReconciler{}))
		updated := obj.DeepCopy()
		updated.Spec.Title = "Changed"
		require.NoError(t, ValidateOnUpdate(ctx, selector, updated, obj, legacy.NoopExternalGroupReconciler{}))
	}
	require.Equal(t, []string{"legacy", "legacy", "legacy", "unified", "unified", "unified", "legacy", "legacy", "legacy"}, calls)
}

type teamReadModeFunc func(context.Context, schema.GroupResource) (bool, error)

func (f teamReadModeFunc) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	return f(ctx, gr)
}

func TestTeamSearchSelectionError(t *testing.T) {
	wantErr := errors.New("mode unavailable")
	reader := teamReadModeFunc(func(context.Context, schema.GroupResource) (bool, error) { return false, wantErr })
	backend := &fakeSearchBackend{searchFunc: func(context.Context, SearchQuery) (*iamv0.GetSearchTeamsResponse, error) {
		t.Fatal("must not search after a selection error")
		return nil, nil
	}}
	selector := dualwrite.NewSelector[SearchBackend](reader, iamv0.TeamResourceInfo.GroupResource(), backend, backend)
	handler := NewSearchHandler(tracing.NewNoopTracerService(), selector, nil)
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "stacks-1"})
	w := httptest.NewRecorder()
	handler.DoTeamSearch(w, httptest.NewRequest("GET", "/searchTeams", nil).WithContext(ctx))
	require.Equal(t, 500, w.Code)

	obj := &iamv0.Team{Spec: iamv0.TeamSpec{Title: "Team"}}
	egr := legacy.NoopExternalGroupReconciler{}
	require.ErrorIs(t, ValidateOnCreate(ctx, selector, obj, egr), wantErr)
	updated := obj.DeepCopy()
	updated.Spec.Title = "Changed"
	require.ErrorIs(t, ValidateOnUpdate(ctx, selector, updated, obj, egr), wantErr)
	require.NoError(t, ValidateOnUpdate(ctx, selector, obj, obj, egr), "unchanged title needs no search")
}

func TestTeamSearchDoesNotFallback(t *testing.T) {
	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode5} {
		cfg := &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{
			iamv0.TeamResourceInfo.GroupResource().String(): {DualWriterMode: mode},
		}}
		wantErr := errors.New("search unavailable")
		legacyBackend := &fakeSearchBackend{err: wantErr}
		unifiedBackend := &fakeSearchBackend{err: wantErr}
		selector := dualwrite.NewSelector[SearchBackend](dualwrite.ProvideServiceForTests(cfg), iamv0.TeamResourceInfo.GroupResource(), legacyBackend, unifiedBackend)
		handler := NewSearchHandler(tracing.NewNoopTracerService(), selector, nil)
		ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "stacks-1"})
		w := httptest.NewRecorder()
		handler.DoTeamSearch(w, httptest.NewRequest("GET", "/searchTeams", nil).WithContext(ctx))
		require.Equal(t, 500, w.Code)
		obj := &iamv0.Team{Spec: iamv0.TeamSpec{Title: "Team"}}
		require.ErrorIs(t, ValidateOnCreate(ctx, selector, obj, legacy.NoopExternalGroupReconciler{}), wantErr)
		require.Equal(t, mode == rest.Mode0, legacyBackend.lastQuery != nil)
		require.Equal(t, mode == rest.Mode5, unifiedBackend.lastQuery != nil)
	}
}

func TestTeamSearchFilters(t *testing.T) {
	for _, tt := range []struct {
		params string
		want   SearchQuery
	}{
		{params: "query=a*b&sort=-email&sort=title", want: SearchQuery{Query: "a*b", Sort: []string{"-email", "title"}}},
		{params: "title=Engineering&uid=one&uid=two", want: SearchQuery{Title: "Engineering", UIDs: []string{"one", "two"}}},
		{params: "teamId=001&teamId=2", want: SearchQuery{TeamIDs: []string{"001", "2"}}},
	} {
		t.Run(tt.params, func(t *testing.T) {
			backend := &fakeSearchBackend{}
			handler := NewSearchHandler(tracing.NewNoopTracerService(), selectorForBackend(backend), nil)
			requester := &user.SignedInUser{Namespace: "stacks-1"}
			ctx := identity.WithRequester(t.Context(), requester)
			w := httptest.NewRecorder()
			handler.DoTeamSearch(w, httptest.NewRequest("GET", "/searchTeams?limit=10&page=2&"+tt.params, nil).WithContext(ctx))
			require.Equal(t, 200, w.Code)
			tt.want.Namespace = "stacks-1"
			tt.want.Limit = 10
			tt.want.Page = 2
			tt.want.Offset = 10
			require.Equal(t, &tt.want, backend.lastQuery)
			require.Same(t, requester, backend.lastRequester)
		})
	}

	for _, params := range []string{
		"query=test&title=test",
		"uid=one&teamId=1",
		"teamId=invalid",
		"teamId=9223372036854775808",
		strings.TrimSuffix(strings.Repeat("uid=one&", maxIDFilterValues+1), "&"),
		strings.TrimSuffix(strings.Repeat("teamId=1&", maxIDFilterValues+1), "&"),
	} {
		t.Run(url.QueryEscape(params), func(t *testing.T) {
			backend := &fakeSearchBackend{}
			handler := NewSearchHandler(tracing.NewNoopTracerService(), selectorForBackend(backend), nil)
			ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "stacks-1"})
			w := httptest.NewRecorder()
			handler.DoTeamSearch(w, httptest.NewRequest("GET", "/searchTeams?"+params, nil).WithContext(ctx))
			require.Equal(t, 400, w.Code)
			require.Nil(t, backend.lastQuery)
		})
	}
}

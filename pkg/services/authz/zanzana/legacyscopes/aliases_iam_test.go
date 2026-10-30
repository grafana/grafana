package legacyscopes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/authlib/types"

	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestScopeAliasesBatchScopeIDs(t *testing.T) {
	var mu sync.Mutex
	counts := map[string]int{}
	object := func(kind, name, id string) map[string]any {
		return map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": kind, "metadata": map[string]any{"name": name, "namespace": "default", "labels": map[string]string{utils.LabelKeyDeprecatedInternalID: id}}}
	}
	iam := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		mu.Lock()
		counts[path]++
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		var body any
		switch {
		case strings.HasSuffix(path, "/users"):
			body = map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "UserList", "items": []any{object("User", "user-one", "7"), object("User", "user-two", "8")}}
		case strings.HasSuffix(path, "/teams"):
			body = map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "TeamList", "items": []any{object("Team", "team-one", "42")}}
		case strings.HasSuffix(path, "/users/user-one"):
			body = object("User", "user-one", "7")
		case strings.HasSuffix(path, "/users/user-two"):
			body = object("User", "user-two", "8")
		case strings.HasSuffix(path, "/teams/team-one"):
			body = object("Team", "team-one", "42")
		default:
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(body)
	}))
	defer iam.Close()
	resolver := NewUIDResolver(aliasRESTConfig(func(context.Context) (*clientrest.Config, error) { return &clientrest.Config{Host: iam.URL}, nil }))
	permissions := []ac.Permission{
		{Action: "users:read", Scope: "global.users:uid:user-one"},
		{Action: "org.users:read", Scope: "users:uid:user-one"},
		{Action: "users:read", Scope: "global.users:uid:user-two"},
		{Action: "teams:read", Scope: "teams:uid:team-one"},
	}
	for range 2 {
		got, err := WithAliases(t.Context(), "default", "", resolver, permissions)
		require.NoError(t, err)
		scopes := map[string]bool{}
		for _, p := range got {
			scopes[p.Scope] = true
		}
		for _, scope := range []string{"global.users:id:7", "global.users:uid:user-one", "users:id:7", "users:uid:user-one", "global.users:id:8", "teams:id:42", "teams:uid:team-one"} {
			require.True(t, scopes[scope], scope)
		}
	}
	mu.Lock()
	defer mu.Unlock()
	require.Equal(t, map[string]int{
		"/apis/iam.grafana.app/v0alpha1/namespaces/default/users": 1,
		"/apis/iam.grafana.app/v0alpha1/namespaces/default/teams": 1,
	}, counts, "namespace Lists should resolve all requested UIDs once and warm requests should reuse both mappings")
}

func TestScopeAliasesIndividualGetFailurePreservesUIDScope(t *testing.T) {
	iam := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	t.Cleanup(iam.Close)
	resolver := NewUIDResolver(aliasRESTConfig(func(context.Context) (*clientrest.Config, error) { return &clientrest.Config{Host: iam.URL}, nil }))
	permissions := []ac.Permission{{Action: "users:read", Scope: "global.users:uid:missing-user"}, {Action: "org.users:read", Scope: "users:uid:missing-user"}}
	got, err := WithAliases(t.Context(), "default", "", resolver, permissions)
	require.NoError(t, err)
	require.Equal(t, permissions, got)
}

type aliasRESTConfig func(context.Context) (*clientrest.Config, error)

func (f aliasRESTConfig) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	return f(ctx)
}

func TestScopeAliasesReverseLookupRejectsAmbiguousMappings(t *testing.T) {
	iam := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Empty(t, r.URL.Query().Get("labelSelector"))
		require.Equal(t, "1000", r.URL.Query().Get("limit"))
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "TeamList", "items": []any{
			map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "Team", "metadata": map[string]any{"name": "one", "labels": map[string]string{utils.LabelKeyDeprecatedInternalID: "42"}}},
			map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "Team", "metadata": map[string]any{"name": "two", "labels": map[string]string{utils.LabelKeyDeprecatedInternalID: "42"}}},
		}}))
	}))
	t.Cleanup(iam.Close)
	resolver := NewUIDResolver(aliasRESTConfig(func(context.Context) (*clientrest.Config, error) { return &clientrest.Config{Host: iam.URL}, nil }))
	input := []ac.Permission{{Action: "teams:read", Scope: "teams:id:42"}}
	got, err := WithAliases(t.Context(), "default", "", resolver, input)
	require.NoError(t, err)
	require.Equal(t, input, got, "ambiguous IDs must not add an arbitrary UID grant")
}

func TestScopeAliasesUIDOnlyObjectNeverProducesIDZero(t *testing.T) {
	var lists, gets atomic.Int64
	var nowHasID atomic.Bool
	iam := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/serviceaccounts") {
			gets.Add(1)
			if nowHasID.Load() {
				w.Header().Set("Content-Type", "application/json")
				require.NoError(t, json.NewEncoder(w).Encode(map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "ServiceAccount", "metadata": map[string]any{"name": "uid-only", "namespace": "default", "labels": map[string]string{utils.LabelKeyDeprecatedInternalID: "9"}}}))
			} else {
				http.NotFound(w, r)
			}
			return
		}
		lists.Add(1)
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "ServiceAccountList", "items": []any{
			map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "ServiceAccount", "metadata": map[string]any{"name": "uid-only", "namespace": "default"}},
		}}))
	}))
	t.Cleanup(iam.Close)
	resolver := NewUIDResolver(aliasRESTConfig(func(context.Context) (*clientrest.Config, error) { return &clientrest.Config{Host: iam.URL}, nil }))
	input := []ac.Permission{{Action: "serviceaccounts:read", Scope: "serviceaccounts:uid:uid-only"}}
	for range 2 {
		got, err := WithAliases(t.Context(), "default", "", resolver, input)
		require.NoError(t, err)
		require.Equal(t, input, got)
	}
	require.Equal(t, int64(1), lists.Load())
	require.Zero(t, gets.Load(), "a known UID-only object must not trigger fallback Gets")
	ns := types.NamespaceInfo{Value: "default", OrgID: 1}
	key := missingScopeKey(ns, ScopeReference{Resource: "serviceaccounts", Attribute: "uid", Value: "uid-only"})
	_, expires, found := resolver.cache.GetWithExpiration(key)
	require.True(t, found)
	require.WithinDuration(t, time.Now().Add(time.Minute), expires, time.Second)
	nowHasID.Store(true)
	resolver.cache.Set(key, true, time.Nanosecond)
	require.Eventually(t, func() bool { _, ok := resolver.cache.Get(key); return !ok }, time.Second, time.Millisecond)
	got, err := WithAliases(t.Context(), "default", "", resolver, input)
	require.NoError(t, err)
	require.Contains(t, got, ac.Permission{Action: "serviceaccounts:read", Scope: "serviceaccounts:id:9"})
	require.Equal(t, int64(1), lists.Load(), "the namespace remains warm")
	require.Equal(t, int64(1), gets.Load(), "refresh the missing mapping after its shorter cache lifetime")
}

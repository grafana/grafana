package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
)

func TestUserPermissionsIndividualScopeIDs(t *testing.T) {
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
	srv, _, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewTypedTuple(common.TypeUser, "user:alice", common.RelationGet, "user-one"),
		common.NewTypedTuple(common.TypeUser, "user:alice", common.RelationGet, "user-two"),
		common.NewTypedTuple(common.TypeTeam, "user:alice", common.RelationGet, "team-one"),
	})
	srv.permissionScopeResolver = legacyscopes.NewUIDResolver(permissionRestConfigProvider(func(context.Context) (*clientrest.Config, error) { return &clientrest.Config{Host: iam.URL}, nil }))
	req := &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:alice"}
	for range 2 {
		stream := &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
		require.NoError(t, srv.GetUserPermissions(req, stream))
		scopes := map[string]bool{}
		for _, p := range stream.permissions {
			scopes[p.Scope] = true
		}
		require.True(t, scopes["global.users:id:7"])
		require.True(t, scopes["global.users:id:8"])
		require.True(t, scopes["teams:id:42"])
	}
	mu.Lock()
	defer mu.Unlock()
	require.Equal(t, map[string]int{
		"/apis/iam.grafana.app/v0alpha1/namespaces/default/users/user-one": 1,
		"/apis/iam.grafana.app/v0alpha1/namespaces/default/users/user-two": 1,
		"/apis/iam.grafana.app/v0alpha1/namespaces/default/teams/team-one": 1,
	}, counts, "individual Gets should resolve each UID once and warm requests should reuse the mappings")
}

func TestUserPermissionsIndividualGetFailurePreservesUIDScope(t *testing.T) {
	iam := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	t.Cleanup(iam.Close)
	srv, _, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewTypedTuple(common.TypeUser, "user:alice", common.RelationGet, "missing-user"),
	})
	srv.permissionScopeResolver = legacyscopes.NewUIDResolver(permissionRestConfigProvider(func(context.Context) (*clientrest.Config, error) {
		return &clientrest.Config{Host: iam.URL}, nil
	}))
	stream := &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
	require.NoError(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:alice"}, stream))
	got := map[[2]string]bool{}
	for _, permission := range stream.permissions {
		got[[2]string{permission.Action, permission.Scope}] = true
	}
	require.Equal(t, map[[2]string]bool{
		{"users:read", "users:uid:missing-user"}:     true,
		{"org.users:read", "users:uid:missing-user"}: true,
	}, got)
}

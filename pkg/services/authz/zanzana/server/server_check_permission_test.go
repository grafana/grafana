package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func TestCheckPermission(t *testing.T) {
	action := "plugins.app:read"
	exactScope := "plugins:id:exact"
	teamScope := "plugins:id:team"
	roleScope := "plugins:id:role"
	theTuples := []*openfgav1.TupleKey{
		{User: "user:marker", Relation: zanzana.RelationGranted, Object: zanzana.FallbackActionObject(action)},
		{User: "user:exact", Relation: zanzana.RelationGranted, Object: zanzana.FallbackPermissionObject(action, exactScope)},
		{User: "user:global", Relation: zanzana.RelationGranted, Object: zanzana.FallbackPermissionObject(action, "*")},
		{User: "user:nested", Relation: zanzana.RelationGranted, Object: zanzana.FallbackPermissionObject(action, "plugins:uid:parent/*")},
		{User: "team:team-one#member", Relation: zanzana.RelationGranted, Object: zanzana.FallbackPermissionObject(action, teamScope)},
		{User: "role:role-one#assignee", Relation: zanzana.RelationGranted, Object: zanzana.FallbackPermissionObject(action, roleScope)},
		{User: "user:role-user", Relation: zanzana.RelationAssignee, Object: "role:role-one"},
		{User: "service-account:sa-one", Relation: zanzana.RelationGranted, Object: zanzana.FallbackPermissionObject(action, exactScope)},
		{User: "anonymous:0", Relation: zanzana.RelationGranted, Object: zanzana.FallbackPermissionObject(action, exactScope)},
	}
	srv := setupOpenFGADatabase(t, setupOpenFGAServer(t), theTuples)

	check := func(t *testing.T, subject string, teams, scopes []string) bool {
		t.Helper()
		res, err := srv.checkPermission(newContextWithNamespace(), &authzextv1.CheckPermissionRequest{
			Namespace: namespace, Subject: subject, Teams: teams, Action: action, Scopes: scopes,
		})
		require.NoError(t, err)
		return res.Allowed
	}

	t.Run("no scope action marker", func(t *testing.T) {
		require.True(t, check(t, "user:marker", nil, []string{""}))
	})
	t.Run("omitted scopes use action marker", func(t *testing.T) {
		require.True(t, check(t, "user:marker", nil, nil))
	})
	t.Run("exact", func(t *testing.T) {
		require.True(t, check(t, "user:exact", nil, []string{exactScope}))
	})
	t.Run("global wildcard", func(t *testing.T) {
		require.True(t, check(t, "user:global", nil, []string{"anything:id:value"}))
	})
	t.Run("nested wildcard", func(t *testing.T) {
		require.True(t, check(t, "user:nested", nil, []string{"plugins:uid:parent/child"}))
	})
	t.Run("multiple scopes are ORed", func(t *testing.T) {
		require.True(t, check(t, "user:exact", nil, []string{"plugins:id:miss", exactScope}))
	})
	t.Run("contextual team", func(t *testing.T) {
		require.True(t, check(t, "user:team-user", []string{"team-one"}, []string{teamScope}))
	})
	t.Run("role assignment", func(t *testing.T) {
		require.True(t, check(t, "user:role-user", nil, []string{roleScope}))
	})
	t.Run("service account", func(t *testing.T) {
		require.True(t, check(t, "service-account:sa-one", nil, []string{exactScope}))
	})
	t.Run("anonymous", func(t *testing.T) {
		require.True(t, check(t, "anonymous:0", nil, []string{exactScope}))
	})
	t.Run("denial", func(t *testing.T) {
		require.False(t, check(t, "user:denied", nil, []string{exactScope}))
	})
	t.Run("invalid subject", func(t *testing.T) {
		_, err := srv.checkPermission(newContextWithNamespace(), &authzextv1.CheckPermissionRequest{
			Namespace: namespace, Subject: "api-key:key", Action: action, Scopes: []string{exactScope},
		})
		require.Error(t, err)
	})
}

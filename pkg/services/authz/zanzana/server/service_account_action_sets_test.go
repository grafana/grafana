package server

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func requireServiceAccountAccess(t *testing.T, srv *Server, permission string, wildcard bool) {
	t.Helper()
	for _, uid := range []string{"sa1", "sa2"} {
		for _, verb := range []string{"get", "update", "delete", "get_permissions", "set_permissions", "create"} {
			result, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
				Namespace: namespace, Subject: "user:manager", Group: "iam.grafana.app", Resource: "serviceaccounts", Name: uid, Verb: verb,
			})
			require.NoError(t, err)
			allowed := permission != "" && (wildcard || uid == "sa1") && verb != "create" && (permission == "Admin" || verb == "get" || verb == "update")
			require.Equal(t, allowed, result.GetAllowed(), "%s: %s on %s", permission, verb, uid)
		}
	}
}

func TestIntegrationServiceAccountRoleActionSets(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, tc := range []struct{ action, permission string }{{"serviceaccounts:edit", "Edit"}, {"serviceaccounts:admin", "Admin"}} {
		for _, scope := range []string{"serviceaccounts:uid:sa1", "serviceaccounts:*"} {
			t.Run(tc.action+"/"+scope, func(t *testing.T) {
				srv := setupOpenFGAServer(t)
				tuples, err := zanzana.RoleToTuples("sa-role", []*v1.RolePermission{{Action: tc.action, Scope: scope}})
				require.NoError(t, err)
				tuples = append(tuples, common.NewTuple("user:manager", "assignee", "role:sa-role"))
				setupOpenFGADatabase(t, srv, tuples)
				requireServiceAccountAccess(t, srv, tc.permission, scope == "serviceaccounts:*")
			})
		}
	}
}

func TestIntegrationServiceAccountPermissionLifecycle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	srv := setupMutateResourcePermissions(t, setupOpenFGAServer(t))
	resource := &v1.Resource{Group: "iam.grafana.app", Resource: "serviceaccounts", Name: "sa1"}
	previous := ""
	for _, permission := range []string{"Edit", "Admin", "Edit", ""} {
		var operations []*v1.MutateOperation
		if previous != "" {
			operations = append(operations, &v1.MutateOperation{Operation: &v1.MutateOperation_DeletePermission{DeletePermission: &v1.DeletePermissionOperation{
				Resource: resource, Permission: &v1.Permission{Kind: "User", Name: "manager", Verb: previous},
			}}})
		}
		if permission != "" {
			operations = append(operations, &v1.MutateOperation{Operation: &v1.MutateOperation_CreatePermission{CreatePermission: &v1.CreatePermissionOperation{
				Resource: resource, Permission: &v1.Permission{Kind: "User", Name: "manager", Verb: permission},
			}}})
		}
		_, err := srv.Mutate(newContextWithZanzanaUpdatePermission(), &v1.MutateRequest{Namespace: namespace, Operations: operations})
		require.NoError(t, err)
		requireServiceAccountAccess(t, srv, permission, false)
		previous = permission
	}
}

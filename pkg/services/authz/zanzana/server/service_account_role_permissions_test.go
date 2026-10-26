package server

import (
	"slices"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationServiceAccountRolePermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, tc := range []struct {
		action string
		verbs  []string
	}{
		{"serviceaccounts:create", []string{"create"}},
		{"serviceaccounts:read", []string{"get", "list", "watch"}},
		{"serviceaccounts:write", []string{"update", "patch"}},
		{"serviceaccounts:delete", []string{"delete", "deletecollection"}},
		{"serviceaccounts.permissions:read", []string{"get_permissions"}},
		{"serviceaccounts.permissions:write", []string{"set_permissions"}},
	} {
		t.Run(tc.action, func(t *testing.T) {
			scope := "serviceaccounts:*"
			if tc.action == "serviceaccounts:create" {
				scope = ""
			}
			srv := setupOpenFGAServer(t)
			tuples, err := zanzana.RoleToTuples("service-account-role", []*authzextv1.RolePermission{{Action: tc.action, Scope: scope}})
			require.NoError(t, err)
			tuples = append(tuples, common.NewTuple("user:manager", "assignee", "role:service-account-role"))
			setupOpenFGADatabase(t, srv, tuples)
			for _, verb := range []string{"create", "get", "list", "watch", "update", "patch", "delete", "deletecollection", "get_permissions", "set_permissions"} {
				for _, name := range []string{"", "*", "sa1"} {
					t.Run(verb+"/"+name, func(t *testing.T) {
						result, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
							Namespace: namespace, Subject: "user:manager", Group: "iam.grafana.app",
							Resource: "serviceaccounts", Verb: verb, Name: name,
						})
						require.NoError(t, err)
						require.Equal(t, slices.Contains(tc.verbs, verb), result.GetAllowed())
					})
				}
			}
			for _, resource := range []string{"users", "teams"} {
				result, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
					Namespace: namespace, Subject: "user:manager", Group: "iam.grafana.app",
					Resource: resource, Verb: tc.verbs[0], Name: "*",
				})
				require.NoError(t, err)
				require.False(t, result.GetAllowed(), "service-account grants must not authorize %s", resource)
			}
		})
	}
}

func TestIntegrationServiceAccountScopedGrantsDoNotAuthorizeAllAccounts(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, scope := range []string{"serviceaccounts:id:42", "serviceaccounts:uid:sa1", "users:*", ""} {
		t.Run(scope, func(t *testing.T) {
			srv := setupOpenFGAServer(t)
			permissions := make([]*authzextv1.RolePermission, 0, 5)
			for _, action := range []string{"serviceaccounts:read", "serviceaccounts:write", "serviceaccounts:delete", "serviceaccounts.permissions:read", "serviceaccounts.permissions:write"} {
				permissions = append(permissions, &authzextv1.RolePermission{Action: action, Scope: scope})
			}
			tuples, err := zanzana.RoleToTuples("scoped-role", permissions)
			require.NoError(t, err)
			tuples = append(tuples, common.NewTuple("user:manager", "assignee", "role:scoped-role"))
			setupOpenFGADatabase(t, srv, tuples)
			for _, verb := range []string{"get", "create", "update", "delete", "get_permissions", "set_permissions"} {
				result, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
					Namespace: namespace, Subject: "user:manager", Group: "iam.grafana.app",
					Resource: "serviceaccounts", Verb: verb, Name: "*",
				})
				require.NoError(t, err)
				require.False(t, result.GetAllowed(), "%s on %q must not grant wildcard access", verb, scope)
			}
		})
	}
}

func TestIntegrationServiceAccountCreateRequiresUnscopedGrant(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, scope := range []string{"permissions:type:delegate", "permissions:type:escalate", "serviceaccounts:id:42", "serviceaccounts:uid:sa1"} {
		t.Run(scope, func(t *testing.T) {
			srv := setupOpenFGAServer(t)
			tuples, err := zanzana.RoleToTuples("create-role", []*authzextv1.RolePermission{{Action: "serviceaccounts:create", Scope: scope}})
			require.NoError(t, err)
			tuples = append(tuples, common.NewTuple("user:manager", "assignee", "role:create-role"))
			setupOpenFGADatabase(t, srv, tuples)
			result, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
				Namespace: namespace, Subject: "user:manager", Group: "iam.grafana.app",
				Resource: "serviceaccounts", Verb: "create",
			})
			require.NoError(t, err)
			require.False(t, result.GetAllowed(), "scope %q must not grant service-account creation", scope)
		})
	}
}

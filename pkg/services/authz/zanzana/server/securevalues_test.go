package server

import (
	"slices"
	"strings"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationSecureValuePermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, level := range []string{"View", "Edit", "Admin"} {
		for _, source := range []string{"resource permission", "managed role"} {
			t.Run(level+"/"+source, func(t *testing.T) {
				permission := accesscontrol.Permission{
					Action: "secret.securevalues:" + strings.ToLower(level),
					Scope:  "secret.securevalues:uid:personal-one",
				}
				var tuples []*openfgav1.TupleKey
				var err error
				if source == "resource permission" {
					tuples, err = zanzana.GetResourcePermissionWriteTuples(&v1.CreatePermissionOperation{
						Resource:   &v1.Resource{Group: "secret.grafana.app", Resource: "securevalues", Name: "personal-one"},
						Permission: &v1.Permission{Kind: "User", Name: "owner", Verb: level},
					})
				} else {
					tuples, err = zanzana.RoleToTuples("secret-role", []*v1.RolePermission{{Action: permission.Action, Scope: permission.Scope}})
					tuples = append(tuples, common.NewTuple("user:owner", "assignee", "role:secret-role"))
				}
				require.NoError(t, err)
				srv := setupOpenFGAServer(t)
				setupOpenFGADatabase(t, srv, tuples)
				rbacService := rbac.NewTestService("owner", []accesscontrol.Permission{permission}, nil)
				listReq := &authzv1.ListRequest{
					Namespace: namespace, Subject: "user:owner",
					Group: "secret.grafana.app", Resource: "securevalues", Verb: "get",
				}
				rbacList, err := rbacService.List(newContextWithNamespace(), listReq)
				require.NoError(t, err)
				zanzanaList, err := srv.List(newContextWithNamespace(), listReq)
				require.NoError(t, err)
				for engine, result := range map[string]*authzv1.ListResponse{"RBAC": rbacList, "Zanzana": zanzanaList} {
					require.False(t, result.GetAll(), engine)
					require.Empty(t, result.GetFolders(), engine)
					require.Equal(t, []string{"personal-one"}, result.GetItems(), engine)
				}
				for _, tc := range []struct {
					verb    string
					allowed bool
				}{
					{"get", true},
					{"list", true},
					{"watch", true},
					{"update", level != "View"},
					{"patch", level != "View"},
					{"delete", level != "View"},
					{"deletecollection", level != "View"},
					{"get_permissions", level == "Admin"},
					{"set_permissions", level == "Admin"},
					{"create", false},
				} {
					for _, name := range []string{"personal-one", "personal-two"} {
						t.Run(tc.verb+"/"+name, func(t *testing.T) {
							req := &authzv1.CheckRequest{
								Namespace: namespace, Subject: "user:owner",
								Group: "secret.grafana.app", Resource: "securevalues", Verb: tc.verb, Name: name,
							}
							want := tc.allowed && name == "personal-one"
							rbacResult, err := rbacService.Check(newContextWithNamespace(), req)
							require.NoError(t, err)
							require.Equal(t, want, rbacResult.GetAllowed(), "RBAC")
							result, err := srv.Check(newContextWithNamespace(), req)
							require.NoError(t, err)
							require.Equal(t, want, result.GetAllowed(), "Zanzana")
							req.Subject = "user:other-user"
							result, err = srv.Check(newContextWithNamespace(), req)
							require.NoError(t, err)
							require.False(t, result.GetAllowed(), "grant must not apply to another user")
						})
					}
				}
			})
		}
	}
}

func TestIntegrationSecureValueLegacyPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, grant := range []struct {
		action string
		verbs  []string
	}{
		{"", nil},
		{"secret.securevalues:read", []string{"get", "list", "watch"}},
		{"secret.securevalues:write", []string{"update", "patch"}},
		{"secret.securevalues:delete", []string{"delete", "deletecollection"}},
		{"secret.securevalues:create", []string{"create"}},
		{"secret.securevalues.permissions:read", []string{"get_permissions"}},
		{"secret.securevalues.permissions:write", []string{"set_permissions"}},
	} {
		for _, scope := range []string{"secret.securevalues:uid:personal-one", "secret.securevalues:*"} {
			t.Run(grant.action+"/"+scope, func(t *testing.T) {
				var permissions []accesscontrol.Permission
				var rolePermissions []*v1.RolePermission
				if grant.action != "" {
					permissions = []accesscontrol.Permission{{Action: grant.action, Scope: scope}}
					rolePermissions = []*v1.RolePermission{{Action: grant.action, Scope: scope}}
				}
				tuples, err := zanzana.RoleToTuples("existing-role", rolePermissions)
				require.NoError(t, err)
				tuples = append(tuples, common.NewTuple("user:owner", "assignee", "role:existing-role"))
				srv := setupOpenFGAServer(t)
				setupOpenFGADatabase(t, srv, tuples)
				rbacService := rbac.NewTestService("owner", permissions, nil)
				for _, verb := range []string{"get", "list", "watch", "update", "patch", "delete", "deletecollection", "create", "get_permissions", "set_permissions"} {
					for _, name := range []string{"personal-one", "personal-two"} {
						t.Run(verb+"/"+name, func(t *testing.T) {
							req := &authzv1.CheckRequest{
								Namespace: namespace, Subject: "user:owner",
								Group: "secret.grafana.app", Resource: "securevalues", Verb: verb, Name: name,
							}
							want := slices.Contains(grant.verbs, verb) && (name == "personal-one" || scope == "secret.securevalues:*")
							rbacResult, err := rbacService.Check(newContextWithNamespace(), req)
							require.NoError(t, err)
							require.Equal(t, want, rbacResult.GetAllowed(), "RBAC")
							result, err := srv.Check(newContextWithNamespace(), req)
							require.NoError(t, err)
							// Zanzana checks creation on the collection, as used by the fixed creator role.
							zanzanaWant := want && (verb != "create" || scope == "secret.securevalues:*")
							require.Equal(t, zanzanaWant, result.GetAllowed(), "Zanzana")
						})
					}
				}
			})
		}
	}
}

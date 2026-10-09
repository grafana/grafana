package server

import (
	"context"
	"fmt"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func setupMutateRoles(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewTuple("role:foo_viewer#assignee", "view", "group_resource:dashboard.grafana.app/dashboards"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func TestIntegrationServerMutateRoles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)
	setupMutateRoles(t, srv)

	t.Run("should update role and delete old role permissions", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithZanzanaUpdatePermission(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreateRole{
						CreateRole: &v1.CreateRoleOperation{
							RoleName: "foo_viewer",
							RoleKind: "Role",
							Permissions: []*v1.RolePermission{
								{
									Action: "dashboards:edit",
									Scope:  "dashboards:*",
								},
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeleteRole{
						DeleteRole: &v1.DeleteRoleOperation{
							RoleName: "foo_viewer",
							RoleKind: "Role",
							Permissions: []*v1.RolePermission{
								{
									Action: "dashboards:view",
									Scope:  "dashboards:*",
								},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				User:     "role:foo_viewer#assignee",
				Relation: "edit",
				Object:   "group_resource:",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "role:foo_viewer#assignee", res.Tuples[0].Key.User)
		require.Equal(t, "group_resource:dashboard.grafana.app/dashboards", res.Tuples[0].Key.Object)
		require.Equal(t, "edit", res.Tuples[0].Key.Relation)
	})
}

func TestIntegrationDatasourceRolePermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, action := range []string{"datasources:query", "datasources:edit", "datasources:admin", "datasources.caching:write"} {
		for _, scope := range []string{"datasources:uid:ds1", "datasources:*"} {
			t.Run(action+"/"+scope, func(t *testing.T) {
				srv := setupOpenFGAServer(t)
				tuples, err := zanzana.RoleToTuples("datasource-role", []*v1.RolePermission{{Action: action, Scope: scope}})
				require.NoError(t, err)
				tuples = append(tuples, common.NewTuple("user:datasource-user", "assignee", "role:datasource-role"))
				setupOpenFGADatabase(t, srv, tuples)
				for _, tc := range []struct {
					verb, subresource string
					allowed           bool
				}{
					{"get", "", action != "datasources.caching:write"},
					{"list", "", action != "datasources.caching:write"},
					{"create", "query", action != "datasources.caching:write"},
					{"create", "", false},
					{"update", "", action == "datasources:edit" || action == "datasources:admin"},
					{"delete", "", action == "datasources:edit" || action == "datasources:admin"},
					{"get_permissions", "", action == "datasources:admin"},
					{"set_permissions", "", action == "datasources:admin"},
					{"get", "caching", action == "datasources:admin"},
					{"update", "caching", action == "datasources:admin" || action == "datasources.caching:write"},
					{"create", "caching", action == "datasources:admin" || action == "datasources.caching:write"},
					{"delete", "caching", action == "datasources:admin" || action == "datasources.caching:write"},
					{"patch", "caching", action == "datasources:admin" || action == "datasources.caching:write"},
					{"deletecollection", "caching", action == "datasources:admin" || action == "datasources.caching:write"},
				} {
					for _, uid := range []string{"ds1", "ds2"} {
						t.Run(tc.verb+"/"+tc.subresource+"/"+uid, func(t *testing.T) {
							result, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
								Namespace: namespace, Subject: "user:datasource-user",
								Group: "datasource.grafana.app", Resource: "datasources",
								Verb: tc.verb, Subresource: tc.subresource, Name: uid,
							})
							require.NoError(t, err)
							require.Equal(t, tc.allowed && (uid == "ds1" || scope == "datasources:*"), result.GetAllowed())
						})
					}
				}
			})
		}
	}
}

// Forward List calls to the real server while satisfying the resolver's client interface.
type datasourcePermissionClient struct {
	zanzana.Client
	server *Server
}

func (c datasourcePermissionClient) List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	return c.server.List(ctx, req)
}

func TestIntegrationDatasourceQueryDoesNotGrantLegacyRead(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, withRead := range []bool{false, true} {
		for _, scope := range []string{"datasources:uid:ds1", "datasources:*"} {
			t.Run(fmt.Sprintf("%s/read=%t", scope, withRead), func(t *testing.T) {
				srv := setupOpenFGAServer(t)
				permissions := []*v1.RolePermission{{Action: "datasources:query", Scope: scope}}
				expected := []accesscontrol.Permission{{Action: "datasources:query", Scope: scope}}
				if withRead {
					permissions = append(permissions, &v1.RolePermission{Action: "datasources:read", Scope: "datasources:uid:ds2"})
					expected = append(expected, accesscontrol.Permission{Action: "datasources:read", Scope: "datasources:uid:ds2"})
				}
				tuples, err := zanzana.RoleToTuples("query-role", permissions)
				require.NoError(t, err)
				tuples = append(tuples, common.NewTuple("user:datasource-user", "assignee", "role:query-role"))
				setupOpenFGADatabase(t, srv, tuples)
				resolver := acimpl.NewZanzanaPermissionResolver(datasourcePermissionClient{server: srv}, nil, nil, false)
				usr := &identity.StaticRequester{Type: "user", UserUID: "datasource-user", OrgID: 1, Namespace: namespace}
				legacy := []accesscontrol.Permission{{Action: "datasources:query", Scope: scope}}
				resolved, err := resolver.ResolveCurrentUserPermissions(newContextWithNamespace(), usr)
				require.NoError(t, err)
				require.ElementsMatch(t, expected, resolved)
				perms := resolver.MergeCurrentUser(newContextWithNamespace(), usr, legacy, log.NewNopLogger())
				require.ElementsMatch(t, expected, perms)
			})
		}
	}
}

func TestIntegrationDatasourceQueryKubernetesRead(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, scope := range []string{"datasources:uid:ds1", "datasources:*"} {
		t.Run(scope, func(t *testing.T) {
			srv := setupOpenFGAServer(t)
			tuples, err := zanzana.RoleToTuples("query-role", []*v1.RolePermission{{Action: "datasources:query", Scope: scope}})
			require.NoError(t, err)
			tuples = append(tuples, common.NewTuple("user:datasource-user", "assignee", "role:query-role"))
			setupOpenFGADatabase(t, srv, tuples)
			for _, group := range []string{"datasource.grafana.app", "loki.datasource.grafana.app"} {
				for _, verb := range []string{"get", "list", "watch"} {
					t.Run(group+"/"+verb, func(t *testing.T) {
						listed, err := srv.List(newContextWithNamespace(), &authzv1.ListRequest{Namespace: namespace, Subject: "user:datasource-user", Group: group, Resource: "datasources", Verb: verb})
						require.NoError(t, err)
						if verb == "watch" {
							require.False(t, listed.All)
							require.Empty(t, listed.Items)
						} else if scope == "datasources:*" {
							require.True(t, listed.All)
						} else {
							require.False(t, listed.All)
							require.Equal(t, []string{"ds1"}, listed.Items)
						}
						for _, uid := range []string{"ds1", "ds2"} {
							expected := verb != "watch" && (uid == "ds1" || scope == "datasources:*")
							checked, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{Namespace: namespace, Subject: "user:datasource-user", Group: group, Resource: "datasources", Verb: verb, Name: uid})
							require.NoError(t, err)
							require.Equal(t, expected, checked.Allowed)
							batch, err := srv.BatchCheck(newContextWithNamespace(), &authzv1.BatchCheckRequest{Namespace: namespace, Subject: "user:datasource-user", Checks: []*authzv1.BatchCheckItem{{CorrelationId: "ds", Group: group, Resource: "datasources", Verb: verb, Name: uid}}})
							require.NoError(t, err)
							require.Empty(t, batch.Results["ds"].Error)
							require.Equal(t, expected, batch.Results["ds"].Allowed)
						}
					})
				}
			}
		})
	}
}

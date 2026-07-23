package server

import (
	"fmt"
	"strings"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	lifecycleDatasourceGroup    = "loki.datasource.grafana.app"
	lifecycleDatasourceResource = "datasources"
)

func datasourcePermissionOperation(delete bool, kind, subject, verb, uid string) *v1.MutateOperation {
	permission := &v1.Permission{
		Kind: string(kind),
		Name: subject,
		Verb: verb,
	}
	resource := &v1.Resource{
		Group:    lifecycleDatasourceGroup,
		Resource: lifecycleDatasourceResource,
		Name:     uid,
	}

	if delete {
		return &v1.MutateOperation{
			Operation: &v1.MutateOperation_DeletePermission{
				DeletePermission: &v1.DeletePermissionOperation{
					Resource:   resource,
					Permission: permission,
				},
			},
		}
	}

	return &v1.MutateOperation{
		Operation: &v1.MutateOperation_CreatePermission{
			CreatePermission: &v1.CreatePermissionOperation{
				Resource:   resource,
				Permission: permission,
			},
		},
	}
}

func datasourceTupleIdentity(subject, relation, uid, subresource string) string {
	object := fmt.Sprintf("resource:%s/%s/%s", lifecycleDatasourceGroup, lifecycleDatasourceResource, uid)
	if subresource != "" {
		object = fmt.Sprintf("resource:%s/%s/%s/%s", lifecycleDatasourceGroup, lifecycleDatasourceResource, subresource, uid)
	}
	return fmt.Sprintf("%s|%s|%s", subject, relation, object)
}

func requireDatasourceTupleIdentities(t *testing.T, srv *Server, subject, uid string, expected ...string) {
	t.Helper()

	var actual []string
	for _, object := range []string{
		fmt.Sprintf("resource:%s/%s/%s", lifecycleDatasourceGroup, lifecycleDatasourceResource, uid),
		fmt.Sprintf("resource:%s/%s/query/%s", lifecycleDatasourceGroup, lifecycleDatasourceResource, uid),
	} {
		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				User:   subject,
				Object: object,
			},
		})
		require.NoError(t, err)
		for _, tuple := range res.Tuples {
			actual = append(actual, fmt.Sprintf("%s|%s|%s", tuple.Key.User, tuple.Key.Relation, tuple.Key.Object))
		}
	}

	require.ElementsMatch(t, expected, actual)
}

func setupMutateResourcePermissions(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewResourceTuple("user:1", common.RelationGet, dashboardGroup, dashboardResource, "", "1"),
		common.NewResourceTuple("user:1", common.RelationUpdate, dashboardGroup, dashboardResource, "", "1"),
		common.NewTypedResourceTuple("user:2", common.RelationGet, common.TypeFolder, folderGroup, folderResource, "", "1"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func TestIntegrationServerMutateResourcePermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)
	setupMutateResourcePermissions(t, srv)

	t.Run("should create new resource permission", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithZanzanaUpdatePermission(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "foo",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "bar",
								Verb: common.RelationGet,
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
				Relation: common.RelationGet,
				Object:   "resource:dashboard.grafana.app/dashboards/foo",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "user:bar", res.Tuples[0].Key.User)
		require.Equal(t, common.RelationGet, res.Tuples[0].Key.Relation)
		require.Equal(t, "resource:dashboard.grafana.app/dashboards/foo", res.Tuples[0].Key.Object)
	})

	t.Run("should delete resource permission", func(t *testing.T) {
		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				User:   "user:1",
				Object: "resource:dashboard.grafana.app/dashboards/1",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 2)

		_, err = srv.Mutate(newContextWithZanzanaUpdatePermission(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "1",
								Verb: common.RelationUpdate,
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		res, err = srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Relation: common.RelationGet,
				Object:   "resource:dashboard.grafana.app/dashboards/1",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "user:1", res.Tuples[0].Key.User)
		require.Equal(t, common.RelationGet, res.Tuples[0].Key.Relation)
		require.Equal(t, "resource:dashboard.grafana.app/dashboards/1", res.Tuples[0].Key.Object)
	})
}

func TestIntegrationServerMutateDatasourcePermissionLifecycle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)
	setupMutateResourcePermissions(t, srv)

	mutate := func(t *testing.T, operations ...*v1.MutateOperation) {
		t.Helper()
		_, err := srv.Mutate(newContextWithZanzanaUpdatePermission(), &v1.MutateRequest{
			Namespace:  "default",
			Operations: operations,
		})
		require.NoError(t, err)
	}

	t.Run("user permission lifecycle", func(t *testing.T) {
		const (
			uid     = "lifecycle-user"
			subject = "user:query-user"
		)

		mutate(t, datasourcePermissionOperation(false, string(iamv0.ResourcePermissionSpecPermissionKindUser), "query-user", "Query", uid))
		requireDatasourceTupleIdentities(t, srv, subject, uid,
			datasourceTupleIdentity(subject, common.RelationSetView, uid, ""),
			datasourceTupleIdentity(subject, common.RelationCreate, uid, "query"),
		)

		mutate(t,
			datasourcePermissionOperation(true, string(iamv0.ResourcePermissionSpecPermissionKindUser), "query-user", "Query", uid),
			datasourcePermissionOperation(false, string(iamv0.ResourcePermissionSpecPermissionKindUser), "query-user", "Edit", uid),
		)
		requireDatasourceTupleIdentities(t, srv, subject, uid,
			datasourceTupleIdentity(subject, common.RelationSetEdit, uid, ""),
			datasourceTupleIdentity(subject, common.RelationCreate, uid, "query"),
		)

		mutate(t,
			datasourcePermissionOperation(true, string(iamv0.ResourcePermissionSpecPermissionKindUser), "query-user", "Edit", uid),
			datasourcePermissionOperation(false, string(iamv0.ResourcePermissionSpecPermissionKindUser), "query-user", "Admin", uid),
		)
		requireDatasourceTupleIdentities(t, srv, subject, uid,
			datasourceTupleIdentity(subject, common.RelationSetAdmin, uid, ""),
			datasourceTupleIdentity(subject, common.RelationCreate, uid, "query"),
		)

		mutate(t,
			datasourcePermissionOperation(true, string(iamv0.ResourcePermissionSpecPermissionKindUser), "query-user", "Admin", uid),
			datasourcePermissionOperation(false, string(iamv0.ResourcePermissionSpecPermissionKindUser), "query-user", "Query", uid),
		)
		requireDatasourceTupleIdentities(t, srv, subject, uid,
			datasourceTupleIdentity(subject, common.RelationSetView, uid, ""),
			datasourceTupleIdentity(subject, common.RelationCreate, uid, "query"),
		)

		const teamSubject = "team:query-team#member"
		mutate(t,
			datasourcePermissionOperation(true, string(iamv0.ResourcePermissionSpecPermissionKindUser), "query-user", "Query", uid),
			datasourcePermissionOperation(false, string(iamv0.ResourcePermissionSpecPermissionKindTeam), "query-team", "Query", uid),
		)
		requireDatasourceTupleIdentities(t, srv, subject, uid)
		requireDatasourceTupleIdentities(t, srv, teamSubject, uid,
			datasourceTupleIdentity(teamSubject, common.RelationSetView, uid, ""),
			datasourceTupleIdentity(teamSubject, common.RelationCreate, uid, "query"),
		)

		mutate(t, datasourcePermissionOperation(true, string(iamv0.ResourcePermissionSpecPermissionKindTeam), "query-team", "Query", uid))
		requireDatasourceTupleIdentities(t, srv, teamSubject, uid)
	})

	for _, test := range []struct {
		name     string
		kind     iamv0.ResourcePermissionSpecPermissionKind
		subject  string
		zSubject string
	}{
		{
			name:     "service account",
			kind:     iamv0.ResourcePermissionSpecPermissionKindServiceAccount,
			subject:  "sa-lifecycle",
			zSubject: "service-account:sa-lifecycle",
		},
		{
			name:     "basic role",
			kind:     iamv0.ResourcePermissionSpecPermissionKindBasicRole,
			subject:  "Editor",
			zSubject: "role:basic_editor#assignee",
		},
	} {
		t.Run(test.name+" create and delete", func(t *testing.T) {
			uid := "lifecycle-" + strings.ReplaceAll(test.name, " ", "-")
			mutate(t, datasourcePermissionOperation(false, string(test.kind), test.subject, "Query", uid))
			requireDatasourceTupleIdentities(t, srv, test.zSubject, uid,
				datasourceTupleIdentity(test.zSubject, common.RelationSetView, uid, ""),
				datasourceTupleIdentity(test.zSubject, common.RelationCreate, uid, "query"),
			)

			mutate(t, datasourcePermissionOperation(true, string(test.kind), test.subject, "Query", uid))
			requireDatasourceTupleIdentities(t, srv, test.zSubject, uid)
		})
	}
}

package server

import (
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestWriteAuthorization(t *testing.T) {
	srv := setupOpenFGAServer(t)
	setup(t, srv)

	req := &authzextv1.WriteRequest{
		Namespace: namespace,
		Writes: &authzextv1.WriteRequestWrites{
			TupleKeys: []*authzextv1.TupleKey{
				{
					// Folder parent tuples are valid without any relationship condition.
					User:     "folder:1",
					Relation: common.RelationParent,
					Object:   "folder:write-authz-test",
				},
			},
		},
	}

	t.Run("denies Write without zanzana:update", func(t *testing.T) {
		_, err := srv.Write(newContextWithNamespace(), req)
		require.Error(t, err)
		require.Equal(t, codes.PermissionDenied, status.Code(err))
	})

	t.Run("allows Write with zanzana:update", func(t *testing.T) {
		_, err := srv.Write(newContextWithZanzanaUpdatePermission(), req)
		require.NoError(t, err)
	})
}

// TestIntegrationK8sNativePermissionDelegation reproduces the original report:
// an Admin holding the K8s-native alerting permission could not delegate it
// because the permission was never translated into an OpenFGA tuple. With the
// K8s-native fallback in TranslateToResourceTuple the tuple is produced, written,
// and the delegation check passes.
func TestIntegrationK8sNativePermissionDelegation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		roleUID         = "r-alerting"
		saUID           = "sa-admin"
		alertingGroup   = "notifications.alerting.grafana.app"
		importsResource = "alertmanagerimports"
	)

	// The permission exactly as granted to the Admin basic role (see the alerting
	// RBAC snapshot in pkg/services/ngalert/accesscontrol/testdata).
	roleTuples, err := zanzana.RoleToTuples(roleUID, []*authzextv1.RolePermission{
		{
			Action: "notifications.alerting.grafana.app/alertmanagerimports:create",
			Scope:  "notifications.alerting.grafana.app/alertmanagerimports:*",
		},
	})
	require.NoError(t, err)

	// Bug 1: before the fallback was added this slice was empty — the permission
	// was silently dropped and never reached Zanzana.
	require.Len(t, roleTuples, 1, "K8s-native permission must translate to a tuple")
	require.Equal(t, common.RelationCreate, roleTuples[0].Relation)
	require.Equal(t, "group_resource:notifications.alerting.grafana.app/alertmanagerimports", roleTuples[0].Object)

	// Bind the service account (which holds Admin) to the role.
	saSubject := common.NewTupleEntry(common.TypeServiceAccount, saUID, "")
	binding := common.NewTuple(saSubject, common.RelationAssignee, common.NewTupleEntry(common.TypeRole, roleUID, ""))

	srv := setupOpenFGAServer(t)
	setupOpenFGADatabase(t, srv, append(roleTuples, binding))

	check := func(subject string) bool {
		resp, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
			Namespace: namespace,
			Subject:   subject,
			Verb:      utils.VerbCreate,
			Group:     alertingGroup,
			Resource:  importsResource,
			Name:      "*",
		})
		require.NoError(t, err)
		return resp.GetAllowed()
	}

	t.Run("admin SA can delegate the alerting create permission", func(t *testing.T) {
		require.True(t, check(saSubject))
	})

	t.Run("unrelated SA cannot", func(t *testing.T) {
		require.False(t, check(common.NewTupleEntry(common.TypeServiceAccount, "sa-other", "")))
	})
}

// TestIntegrationK8sNativeCreateOnNamedScopeRejected guards the bug fixed on top
// of the PR: a "create" verb scoped to a specific named instance must not produce
// a "resource"-type tuple, because the FGA "resource" type has no "create" relation
// (schema_resource.fga) and OpenFGA rejects such a write.
func TestIntegrationK8sNativeCreateOnNamedScopeRejected(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)
	setup(t, srv)

	t.Run("openfga rejects a create relation on the resource type", func(t *testing.T) {
		_, err := srv.Write(newContextWithZanzanaUpdatePermission(), &authzextv1.WriteRequest{
			Namespace: namespace,
			Writes: &authzextv1.WriteRequestWrites{
				TupleKeys: []*authzextv1.TupleKey{
					{
						User:     "user:u001",
						Relation: common.RelationCreate,
						Object:   "resource:myapp.ext.grafana.com/widgets/widget-1",
					},
				},
			},
		})
		require.Error(t, err)
	})

	t.Run("translation drops create on a named scope so the invalid tuple is never produced", func(t *testing.T) {
		tuples, err := zanzana.RoleToTuples("r-widgets", []*authzextv1.RolePermission{
			{
				Action: "myapp.ext.grafana.com/widgets:create",
				Scope:  "myapp.ext.grafana.com/widgets:uid:widget-1",
			},
		})
		require.NoError(t, err)
		require.Empty(t, tuples)
	})
}

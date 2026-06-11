package reconciler

import (
	"context"
	"strconv"
	"testing"

	claims "github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/authz/idresolver"
)

type fakeTeamLister struct {
	teams []idresolver.TeamRef
}

func (f fakeTeamLister) ListTeams(_ context.Context, _ claims.NamespaceInfo) ([]idresolver.TeamRef, error) {
	return f.teams, nil
}

func teamUnstructured(t *testing.T, name, namespace string, internalID int64) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{}
	obj.SetGroupVersionKind(iamv0.TeamResourceInfo.GroupVersionKind())
	obj.SetName(name)
	obj.SetNamespace(namespace)
	if internalID != 0 {
		obj.SetLabels(map[string]string{utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(internalID, 10)})
	}
	return obj
}

// TestReconcilerListTeams exercises the mode-5 path: the reconciler lists teams from
// unified storage and maps each to its deprecatedInternalID label (no legacy SQL). The
// bulk resolver is then built from that list.
func TestReconcilerListTeams(t *testing.T) {
	const namespace = "stacks-1"
	gvr := iamv0.TeamResourceInfo.GroupVersionResource()

	objs := []runtime.Object{
		teamUnstructured(t, "team-five", namespace, 5),
		teamUnstructured(t, "team-seven", namespace, 7),
		teamUnstructured(t, "team-noid", namespace, 0), // no internal id -> excluded
	}

	dc := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(
		runtime.NewScheme(),
		map[schema.GroupVersionResource]string{gvr: "TeamList"},
		objs...,
	)
	resourceIface := dc.Resource(gvr).Namespace(namespace)

	rcs := resources.NewMockResourceClients(t)
	rcs.On("ForResource", mock.Anything, gvr).Return(resourceIface, schema.GroupVersionKind{}, nil)
	cf := resources.NewMockClientFactory(t)
	cf.On("Clients", mock.Anything, namespace).Return(rcs, nil)

	r := newReconcilerForTest(&stubServer{}, cf)
	ns := claims.NamespaceInfo{Value: namespace}

	// The reconciler is the TeamLister; the bulk resolver lists once and answers from memory.
	resolver, err := idresolver.NewBulkResolver(context.Background(), ns, r)
	require.NoError(t, err)

	uid, err := resolver.IDToUID(context.Background(), ns, idresolver.KindTeam, 5)
	require.NoError(t, err)
	require.Equal(t, "team-five", uid)

	uid, err = resolver.IDToUID(context.Background(), ns, idresolver.KindTeam, 7)
	require.NoError(t, err)
	require.Equal(t, "team-seven", uid)

	_, err = resolver.IDToUID(context.Background(), ns, idresolver.KindTeam, 999)
	require.ErrorIs(t, err, idresolver.ErrNotFound)

	id, err := resolver.UIDToID(context.Background(), ns, idresolver.KindTeam, "team-five")
	require.NoError(t, err)
	require.Equal(t, int64(5), id)
}

// TestTranslateRoleToTuples_TeamPermissions verifies the reconciler end-to-end:
// a Role carrying id-based team-management scopes is resolved to uid through the shared
// resolver and emitted as per-instance team tuples; orphaned ids are dropped.
func TestTranslateRoleToTuples_TeamPermissions(t *testing.T) {
	role := &iamv0.Role{
		ObjectMeta: metav1.ObjectMeta{Name: "team-mgr"},
		Spec: iamv0.RoleSpec{
			Permissions: []iamv0.RolespecPermission{
				{Action: "teams:read", Scope: "teams:id:5"},
				{Action: "teams.permissions:write", Scope: "teams:id:5"},
				{Action: "teams:write", Scope: "teams:id:999"}, // orphaned -> dropped
			},
		},
	}

	resolver, err := idresolver.NewBulkResolver(context.Background(), claims.NamespaceInfo{}, fakeTeamLister{
		teams: []idresolver.TeamRef{{UID: "team-five", ID: 5}},
	})
	require.NoError(t, err)

	tuples, err := TranslateRoleToTuples(context.Background(), toUnstructured(t, role), nil, resolver, claims.NamespaceInfo{}, log.NewNopLogger())
	require.NoError(t, err)

	require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
		{User: "role:team-mgr#assignee", Relation: "get", Object: "team:team-five"},
		{User: "role:team-mgr#assignee", Relation: "set_permissions", Object: "team:team-five"},
	}), tupleKeyStrings(tuples))

	// Resolved per-instance team tuples must conform to the FGA model.
	ts := loadTypesystem(t)
	for _, tu := range tuples {
		validateTupleAgainstSchema(t, ts, tu)
	}
}

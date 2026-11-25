package dualwrite

import (
	"context"
	"maps"
	"slices"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	zclient "github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	zanzanacommon "github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

type fakeZanzanaClient struct {
	zclient.NoopClient
	readTuples []*authzextv1.Tuple
	writeReqs  []*authzextv1.WriteRequest
}

func (f *fakeZanzanaClient) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	return &authzextv1.ReadResponse{
		Tuples:            f.readTuples,
		ContinuationToken: "",
	}, nil
}

func (f *fakeZanzanaClient) Write(ctx context.Context, req *authzextv1.WriteRequest) error {
	f.writeReqs = append(f.writeReqs, req)
	return nil
}

func (f *fakeZanzanaClient) List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	return &authzv1.ListResponse{}, nil
}

func (f *fakeZanzanaClient) Mutate(ctx context.Context, req *authzextv1.MutateRequest) error {
	return nil
}

func (f *fakeZanzanaClient) Query(ctx context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error) {
	return &authzextv1.QueryResponse{}, nil
}

func (f *fakeZanzanaClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: true}, nil
}

func (f *fakeZanzanaClient) Compile(ctx context.Context, info authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(name, folder string) bool { return true }, authlib.NoopZookie{}, nil
}

func (f *fakeZanzanaClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

func TestResourceReconciler_OrphanedManagedDashboardTuplesAreDeleted(t *testing.T) {
	legacy := func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		return map[string]map[string]*openfgav1.TupleKey{}, nil
	}
	zCollector := func(ctx context.Context, client zanzana.Client, object string, namespace string) (map[string]*openfgav1.TupleKey, error) {
		return map[string]*openfgav1.TupleKey{}, nil
	}

	fake := &fakeZanzanaClient{}
	r := newResourceReconciler("managed dashboard permissions", legacy, zCollector, fake)

	require.NotEmpty(t, r.orphanObjectPrefix)
	require.NotEmpty(t, r.orphanRelations)

	relAllowed := r.orphanRelations[0]
	objAllowed := r.orphanObjectPrefix + "dash-uid-1"

	fake.readTuples = []*authzextv1.Tuple{
		// should be removed
		{
			Key: &authzextv1.TupleKey{
				User:     "user:1",
				Relation: relAllowed,
				Object:   objAllowed,
			},
		},

		// same relation but different object type/prefix - should stay
		{
			Key: &authzextv1.TupleKey{
				User:     "user:1",
				Relation: relAllowed,
				Object:   "folder:some-folder",
			},
		},
		// same prefix but different relation - should stay
		{
			Key: &authzextv1.TupleKey{
				User:     "user:1",
				Relation: zanzana.RelationParent,
				Object:   objAllowed,
			},
		},
	}

	err := r.reconcile(context.Background(), authlib.OrgNamespaceFormatter(1))
	require.NoError(t, err)

	require.Len(t, fake.writeReqs, 1)
	wr := fake.writeReqs[0]
	require.NotNil(t, wr.Deletes)
	require.Nil(t, wr.Writes)

	require.Len(t, wr.Deletes.TupleKeys, 1)
	del := wr.Deletes.TupleKeys[0]
	require.Equal(t, "user:1", del.User)
	require.Equal(t, relAllowed, del.Relation)
	require.Equal(t, objAllowed, del.Object)
}

// The basic roles' grants on the root folder are written by the role
// permissions reconciler. The managed folder permissions reconciler sees no
// managed permission on folder:general, so without protection it deleted them
// as orphans on every cycle, and users were denied until role permissions wrote
// them back.
func TestResourceReconciler_ProtectedTuplesAreNotDeleted(t *testing.T) {
	noManaged := func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		return map[string]map[string]*openfgav1.TupleKey{}, nil
	}
	rootCreate := &openfgav1.TupleKey{User: "role:basic_editor#assignee", Relation: zanzana.RelationCreate, Object: "folder:general"}
	rolePermissions := func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		return map[string]map[string]*openfgav1.TupleKey{
			rootCreate.Object: {rootCreate.String(): rootCreate},
		}, nil
	}
	zCollector := func(ctx context.Context, client zanzana.Client, object string, namespace string) (map[string]*openfgav1.TupleKey, error) {
		return map[string]*openfgav1.TupleKey{}, nil
	}

	fake := &fakeZanzanaClient{readTuples: []*authzextv1.Tuple{
		// written by role permissions: must stay
		{Key: &authzextv1.TupleKey{User: rootCreate.User, Relation: rootCreate.Relation, Object: rootCreate.Object}},
		// no collector returns it: an orphan, so it is still deleted
		{Key: &authzextv1.TupleKey{User: "user:1", Relation: zanzana.RelationCreate, Object: "folder:removed"}},
	}}

	r := newResourceReconciler("managed folder permissions", noManaged, zCollector, fake).withProtected(rolePermissions)
	require.NoError(t, r.reconcile(context.Background(), authlib.OrgNamespaceFormatter(1)))

	require.Len(t, fake.writeReqs, 1)
	require.NotNil(t, fake.writeReqs[0].Deletes)
	deletes := fake.writeReqs[0].Deletes.TupleKeys
	require.Len(t, deletes, 1)
	require.Equal(t, "user:1", deletes[0].User)
	require.Equal(t, "folder:removed", deletes[0].Object)
}

// statefulZanzanaClient stores tuples across reconciles, so a test can run
// several cycles. Like the Zanzana server, which writes with OnDuplicate and
// OnMissing set to ignore, it keeps an existing tuple when asked to write it
// again. writes counts every tuple a reconciler asked to write.
type statefulZanzanaClient struct {
	zclient.NoopClient
	tuples map[string]*authzextv1.TupleKey
	writes int
}

func (f *statefulZanzanaClient) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	keys := slices.Sorted(maps.Keys(f.tuples))
	out := []*authzextv1.Tuple{}
	for _, k := range keys {
		t := f.tuples[k]
		if filter := req.GetTupleKey(); filter != nil {
			if filter.GetObject() != "" && filter.GetObject() != t.GetObject() {
				continue
			}
			if filter.GetRelation() != "" && filter.GetRelation() != t.GetRelation() {
				continue
			}
		}
		out = append(out, &authzextv1.Tuple{Key: proto.Clone(t).(*authzextv1.TupleKey)})
	}
	return &authzextv1.ReadResponse{Tuples: out}, nil
}

func (f *statefulZanzanaClient) Write(ctx context.Context, req *authzextv1.WriteRequest) error {
	for _, d := range req.GetDeletes().GetTupleKeys() {
		delete(f.tuples, tupleKey(d.GetUser(), d.GetRelation(), d.GetObject()))
	}
	for _, w := range req.GetWrites().GetTupleKeys() {
		f.writes++
		k := tupleKey(w.GetUser(), w.GetRelation(), w.GetObject())
		if _, ok := f.tuples[k]; ok {
			continue
		}
		f.tuples[k] = proto.Clone(w).(*authzextv1.TupleKey)
	}
	return nil
}

// Two reconcilers may collect the same folder resource tuple with different
// subresource filters: here a managed permission and a role both grant the
// Editor basic role resource_create on the root folder, for annotations and
// for dashboards. Each used to replace the stored tuple with its own filter,
// so one of the grants was missing after every reconcile. Both now write the
// merged filter, and after the first cycle nothing changes.
func TestResourceReconciler_SharedFolderResourceTupleKeepsBothFilters(t *testing.T) {
	const editor = "role:basic_editor#assignee"
	collector := func(group, resource string) legacyTupleCollector {
		return func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
			tuple := zanzanacommon.NewFolderResourceTuple(editor, zanzana.RelationCreate, group, resource, "", "general")
			return map[string]map[string]*openfgav1.TupleKey{
				tuple.Object: {zanzana.TupleStringWithoutCondition(tuple): tuple},
			}, nil
		}
	}
	managed := collector("annotation.grafana.app", "annotations")
	roles := collector("dashboard.grafana.app", "dashboards")

	fake := &statefulZanzanaClient{tuples: map[string]*authzextv1.TupleKey{}}
	managedReconciler := newResourceReconciler("managed folder permissions", managed, zanzanaCollector(zanzana.RelationsFolder, 100), fake).withProtected(roles)
	roleReconciler := newResourceReconciler("role permissions", roles, zanzanaCollector(zanzana.RelationsFolder, 100), fake).withProtected(managed)

	filters := func() []string {
		t.Helper()
		stored, ok := fake.tuples[tupleKey(editor, "resource_create", "folder:general")]
		require.True(t, ok, "the Editor's root folder grant is missing")
		values := stored.GetCondition().GetContext().GetFields()["subresources"].GetListValue().GetValues()
		out := make([]string, 0, len(values))
		for _, v := range values {
			out = append(out, v.GetStringValue())
		}
		return out
	}
	want := []string{"annotation.grafana.app/annotations", "dashboard.grafana.app/dashboards"}

	ns := authlib.OrgNamespaceFormatter(1)
	var writesAfterFirstCycle int
	for cycle := range 3 {
		require.NoError(t, managedReconciler.reconcile(context.Background(), ns))
		require.Equal(t, want, filters(), "after the managed reconciler, cycle %d", cycle)
		require.NoError(t, roleReconciler.reconcile(context.Background(), ns))
		require.Equal(t, want, filters(), "after the role reconciler, cycle %d", cycle)
		if cycle == 0 {
			writesAfterFirstCycle = fake.writes
		}
	}
	require.Equal(t, writesAfterFirstCycle, fake.writes, "a converged tuple was written again")
}

// Action set grants (resource_view, resource_edit, resource_admin) are folder
// resource tuples without a subresource filter. When two reconcilers collect
// the same one there is nothing to merge, and reconciling must not panic.
func TestResourceReconciler_SharedActionSetTupleIsKept(t *testing.T) {
	const editor = "role:basic_editor#assignee"
	collector := func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		tuple := zanzanacommon.NewFolderResourceTuple(editor, zanzana.RelationSetEdit, "dashboard.grafana.app", "dashboards", "", "general")
		return map[string]map[string]*openfgav1.TupleKey{
			tuple.Object: {zanzana.TupleStringWithoutCondition(tuple): tuple},
		}, nil
	}

	fake := &statefulZanzanaClient{tuples: map[string]*authzextv1.TupleKey{}}
	managedReconciler := newResourceReconciler("managed folder permissions", collector, zanzanaCollector(zanzana.RelationsFolder, 100), fake).withProtected(collector)
	roleReconciler := newResourceReconciler("role permissions", collector, zanzanaCollector(zanzana.RelationsFolder, 100), fake).withProtected(collector)

	ns := authlib.OrgNamespaceFormatter(1)
	for range 2 {
		require.NoError(t, managedReconciler.reconcile(context.Background(), ns))
		require.NoError(t, roleReconciler.reconcile(context.Background(), ns))
	}

	stored, ok := fake.tuples[tupleKey(editor, zanzana.RelationSubresourceSetEdit, "folder:general")]
	require.True(t, ok, "the Editor's root folder edit grant is missing")
	require.Nil(t, stored.GetCondition())
}

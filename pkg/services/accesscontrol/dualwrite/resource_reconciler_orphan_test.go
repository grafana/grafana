package dualwrite

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

type fakeZanzanaClient struct {
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

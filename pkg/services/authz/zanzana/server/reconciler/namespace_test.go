package reconciler

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// mockOpenFGAServer implements only the Read method; all others panic via the embedded Unimplemented.
type mockOpenFGAServer struct {
	openfgav1.UnimplementedOpenFGAServiceServer
	// pages is a list of tuple pages to return on successive Read calls.
	pages [][]*openfgav1.Tuple
}

func (m *mockOpenFGAServer) Read(_ context.Context, _ *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error) {
	if len(m.pages) == 0 {
		return &openfgav1.ReadResponse{}, nil
	}
	page := m.pages[0]
	m.pages = m.pages[1:]

	token := ""
	if len(m.pages) > 0 {
		token = "next"
	}
	return &openfgav1.ReadResponse{
		Tuples:            page,
		ContinuationToken: token,
	}, nil
}

// mockServerInternal satisfies zanzana.ServerInternal for computeDiffStreaming tests.
type mockServerInternal struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer
	fga *mockOpenFGAServer
}

func (m *mockServerInternal) Close()                              {}
func (m *mockServerInternal) RunReconciler(context.Context) error { return nil }
func (m *mockServerInternal) GetStore(context.Context, string) (*zanzana.StoreInfo, error) {
	return &zanzana.StoreInfo{ID: "test"}, nil
}
func (m *mockServerInternal) GetOrCreateStore(context.Context, string) (*zanzana.StoreInfo, error) {
	return &zanzana.StoreInfo{ID: "test"}, nil
}
func (m *mockServerInternal) DeleteStore(context.Context, string) error {
	return nil
}
func (m *mockServerInternal) ListAllStores(context.Context) ([]zanzana.StoreInfo, error) {
	return nil, nil
}
func (m *mockServerInternal) WriteTuples(context.Context, *zanzana.StoreInfo, []*openfgav1.TupleKey, []*openfgav1.TupleKeyWithoutCondition) error {
	return nil
}
func (m *mockServerInternal) GetOpenFGAServer() openfgav1.OpenFGAServiceServer {
	return m.fga
}

func makeTuple(user, relation, object string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{User: user, Relation: relation, Object: object}
}

func makeTupleWithCondition(user, relation, object, condition string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User: user, Relation: relation, Object: object,
		Condition: &openfgav1.RelationshipCondition{Name: condition},
	}
}

func TestTupleKey(t *testing.T) {
	t.Run("different fields produce different keys", func(t *testing.T) {
		a := tupleKey(makeTuple("user:1", "viewer", "doc:1"))
		b := tupleKey(makeTuple("user:2", "viewer", "doc:1"))
		c := tupleKey(makeTuple("user:1", "editor", "doc:1"))
		d := tupleKey(makeTuple("user:1", "viewer", "doc:2"))

		assert.NotEqual(t, a, b)
		assert.NotEqual(t, a, c)
		assert.NotEqual(t, a, d)
	})

	t.Run("same fields produce same key", func(t *testing.T) {
		a := tupleKey(makeTuple("user:1", "viewer", "doc:1"))
		b := tupleKey(makeTuple("user:1", "viewer", "doc:1"))
		assert.Equal(t, a, b)
	})

	t.Run("condition is ignored", func(t *testing.T) {
		a := tupleKey(makeTuple("user:1", "viewer", "doc:1"))
		b := tupleKey(makeTupleWithCondition("user:1", "viewer", "doc:1", "some_condition"))
		assert.Equal(t, a, b)
	})

	t.Run("null byte separator prevents collisions", func(t *testing.T) {
		a := tupleKey(makeTuple("ab", "c", "d"))
		b := tupleKey(makeTuple("a", "bc", "d"))
		assert.NotEqual(t, a, b)
	})
}

func toTuple(tk *openfgav1.TupleKey) *openfgav1.Tuple {
	return &openfgav1.Tuple{Key: tk}
}

func newTestReconciler(pages [][]*openfgav1.Tuple) *Reconciler {
	return &Reconciler{
		server:  &mockServerInternal{fga: &mockOpenFGAServer{pages: pages}},
		cfg:     Config{CRDs: DefaultCRDs},
		logger:  log.NewNopLogger(),
		tracer:  tracing.NewNoopTracerService(),
		metrics: newReconcilerMetrics(prometheus.NewRegistry()),
	}
}

func TestComputeDiffStreaming(t *testing.T) {
	ctx := context.Background()

	t.Run("all in sync", func(t *testing.T) {
		a := makeTuple("user:1", "viewer", "doc:1")
		b := makeTuple("user:2", "editor", "doc:2")

		expectedMap := map[string]*openfgav1.TupleKey{
			tupleKey(a): a,
			tupleKey(b): b,
		}
		pages := [][]*openfgav1.Tuple{{toTuple(a), toTuple(b)}}

		r := newTestReconciler(pages)
		toAdd, toDelete, err := r.computeDiffStreaming(ctx, "ns", expectedMap)
		require.NoError(t, err)
		assert.Empty(t, toAdd)
		assert.Empty(t, toDelete)
	})

	t.Run("tuples to add", func(t *testing.T) {
		a := makeTuple("user:1", "viewer", "doc:1")
		b := makeTuple("user:2", "editor", "doc:2")
		c := makeTuple("user:3", "admin", "doc:3")

		expectedMap := map[string]*openfgav1.TupleKey{
			tupleKey(a): a,
			tupleKey(b): b,
			tupleKey(c): c,
		}
		pages := [][]*openfgav1.Tuple{{toTuple(a), toTuple(b)}}

		r := newTestReconciler(pages)
		toAdd, toDelete, err := r.computeDiffStreaming(ctx, "ns", expectedMap)
		require.NoError(t, err)
		require.Len(t, toAdd, 1)
		assert.Equal(t, tupleKey(c), tupleKey(toAdd[0]))
		assert.Empty(t, toDelete)
	})

	t.Run("tuples to delete", func(t *testing.T) {
		a := makeTuple("user:1", "viewer", "doc:1")
		b := makeTuple("user:2", "editor", "doc:2")

		expectedMap := map[string]*openfgav1.TupleKey{
			tupleKey(a): a,
		}
		pages := [][]*openfgav1.Tuple{{toTuple(a), toTuple(b)}}

		r := newTestReconciler(pages)
		toAdd, toDelete, err := r.computeDiffStreaming(ctx, "ns", expectedMap)
		require.NoError(t, err)
		assert.Empty(t, toAdd)
		require.Len(t, toDelete, 1)
		assert.Equal(t, tupleKey(b), tupleKey(toDelete[0]))
	})

	t.Run("condition changed", func(t *testing.T) {
		expected := makeTupleWithCondition("user:1", "viewer", "doc:1", "new_cond")
		current := makeTupleWithCondition("user:1", "viewer", "doc:1", "old_cond")

		expectedMap := map[string]*openfgav1.TupleKey{
			tupleKey(expected): expected,
		}
		pages := [][]*openfgav1.Tuple{{toTuple(current)}}

		r := newTestReconciler(pages)
		toAdd, toDelete, err := r.computeDiffStreaming(ctx, "ns", expectedMap)
		require.NoError(t, err)
		// Expected stays in map (condition mismatch) → re-added
		require.Len(t, toAdd, 1)
		assert.Equal(t, "new_cond", toAdd[0].GetCondition().GetName())
		// Old tuple is deleted
		require.Len(t, toDelete, 1)
		assert.Equal(t, "old_cond", toDelete[0].GetCondition().GetName())
	})

	t.Run("empty zanzana", func(t *testing.T) {
		a := makeTuple("user:1", "viewer", "doc:1")
		b := makeTuple("user:2", "editor", "doc:2")

		expectedMap := map[string]*openfgav1.TupleKey{
			tupleKey(a): a,
			tupleKey(b): b,
		}

		r := newTestReconciler(nil)
		toAdd, toDelete, err := r.computeDiffStreaming(ctx, "ns", expectedMap)
		require.NoError(t, err)
		assert.Len(t, toAdd, 2)
		assert.Empty(t, toDelete)
	})

	t.Run("empty expected", func(t *testing.T) {
		a := makeTuple("user:1", "viewer", "doc:1")
		b := makeTuple("user:2", "editor", "doc:2")

		expectedMap := map[string]*openfgav1.TupleKey{}
		pages := [][]*openfgav1.Tuple{{toTuple(a), toTuple(b)}}

		r := newTestReconciler(pages)
		toAdd, toDelete, err := r.computeDiffStreaming(ctx, "ns", expectedMap)
		require.NoError(t, err)
		assert.Empty(t, toAdd)
		assert.Len(t, toDelete, 2)
	})

	t.Run("multi page", func(t *testing.T) {
		a := makeTuple("user:1", "viewer", "doc:1")
		b := makeTuple("user:2", "editor", "doc:2")
		c := makeTuple("user:3", "admin", "doc:3")
		d := makeTuple("user:4", "viewer", "doc:4")

		// Expected: A, B, C. Zanzana has: A, D (page 1) and B (page 2).
		expectedMap := map[string]*openfgav1.TupleKey{
			tupleKey(a): a,
			tupleKey(b): b,
			tupleKey(c): c,
		}
		pages := [][]*openfgav1.Tuple{
			{toTuple(a), toTuple(d)},
			{toTuple(b)},
		}

		r := newTestReconciler(pages)
		toAdd, toDelete, err := r.computeDiffStreaming(ctx, "ns", expectedMap)
		require.NoError(t, err)

		// C needs to be added
		require.Len(t, toAdd, 1)
		assert.Equal(t, tupleKey(c), tupleKey(toAdd[0]))

		// D needs to be deleted
		require.Len(t, toDelete, 1)
		assert.Equal(t, tupleKey(d), tupleKey(toDelete[0]))
	})
}

func TestConditionChangeDetection(t *testing.T) {
	t.Run("same key maps to same entry but different conditions are not proto equal", func(t *testing.T) {
		a := makeTupleWithCondition("user:1", "viewer", "doc:1", "cond_a")
		b := makeTupleWithCondition("user:1", "viewer", "doc:1", "cond_b")

		// Keys match (condition excluded from key)
		assert.Equal(t, tupleKey(a), tupleKey(b))

		// But conditions differ
		assert.False(t, proto.Equal(a.GetCondition(), b.GetCondition()))
	})

	t.Run("nil vs non-nil condition are not equal", func(t *testing.T) {
		a := makeTuple("user:1", "viewer", "doc:1")
		b := makeTupleWithCondition("user:1", "viewer", "doc:1", "cond_a")

		assert.Equal(t, tupleKey(a), tupleKey(b))
		assert.False(t, proto.Equal(a.GetCondition(), b.GetCondition()))
	})

	t.Run("same conditions are equal", func(t *testing.T) {
		a := makeTupleWithCondition("user:1", "viewer", "doc:1", "cond_a")
		b := makeTupleWithCondition("user:1", "viewer", "doc:1", "cond_a")

		assert.True(t, proto.Equal(a.GetCondition(), b.GetCondition()))
	})

	t.Run("both nil conditions are equal", func(t *testing.T) {
		a := makeTuple("user:1", "viewer", "doc:1")
		b := makeTuple("user:1", "viewer", "doc:1")

		assert.True(t, proto.Equal(a.GetCondition(), b.GetCondition()))
	})
}

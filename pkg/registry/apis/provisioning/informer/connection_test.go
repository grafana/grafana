package informer

import (
	"context"
	"errors"
	"iter"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/prometheus/client_golang/prometheus"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
)

func conn(namespace, name string) *provisioningapis.Connection {
	return &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name}}
}

// stubKeysLister serves a canned key stream, optionally ending in an error, so
// the re-list can be driven without a storage backend.
type stubKeysLister struct {
	listRV int64
	keys   []Key
	err    error
	called int
}

func (s *stubKeysLister) ListKeys(context.Context) (int64, iter.Seq2[Key, error]) {
	s.called++
	return s.listRV, func(yield func(Key, error) bool) {
		for _, k := range s.keys {
			if !yield(k, nil) {
				return
			}
		}
		if s.err != nil {
			yield(Key{}, s.err)
		}
	}
}

func names(t *testing.T, objs []runtime.Object) []string {
	t.Helper()
	out := make([]string, 0, len(objs))
	for _, o := range objs {
		c, ok := o.(*provisioningapis.Connection)
		require.True(t, ok, "expected *Connection, got %T", o)
		out = append(out, c.Name)
	}
	return out
}

// The keys the informer's Store diffs on have to survive the projection: it keys
// on namespace/name and compares resourceVersion, so losing any of the three
// would make every re-list look like a change, or like no change at all.
// recordProjection captures what the re-list reported it used, which is what the
// keys_only_relist rollout is read by.
func recordProjection(seen *[]bool) func(bool) {
	return func(keysOnly bool) { *seen = append(*seen, keysOnly) }
}

func TestConnectionList_KeysOnly(t *testing.T) {
	keys := &stubKeysLister{listRV: 100, keys: []Key{
		{Namespace: "ns1", Name: "a", ResourceVersion: "10"},
		{Namespace: "ns2", Name: "b", ResourceVersion: "11"},
	}}
	// Seeded, so a full-object list would return a different name and the test
	// can tell the two paths apart.
	client := fake.NewClientset(conn(testNamespace, "from-full-list"))

	var seen []bool
	objs, listRV, err := connectionList(client.ProvisioningV0alpha1(), testNamespace, keys, recordProjection(&seen))(t.Context())
	require.NoError(t, err)

	assert.Equal(t, []bool{true}, seen, "the tick must report that keys served it")
	assert.Equal(t, int64(100), listRV, "the snapshot version the Store arbitrates against")
	assert.Equal(t, []string{"a", "b"}, names(t, objs))

	got, ok := objs[0].(*provisioningapis.Connection)
	require.True(t, ok)
	assert.Equal(t, "ns1", got.Namespace)
	assert.Equal(t, "10", got.ResourceVersion, "the Store compares this to decide what changed")
}

// Storage older than keys_only must degrade to the full list rather than stop
// reconciling, since the re-list is the connection controller's only feed.
func TestConnectionList_FallsBackWhenKeysOnlyUnsupported(t *testing.T) {
	keys := &stubKeysLister{err: ErrKeysOnlyUnsupported}
	client := fake.NewClientset(conn(testNamespace, "from-full-list"))

	var seen []bool
	objs, _, err := connectionList(client.ProvisioningV0alpha1(), testNamespace, keys, recordProjection(&seen))(t.Context())
	require.NoError(t, err, "an unsupported projection is not a reason to fail the tick")

	assert.Equal(t, []bool{false}, seen, "the fallback must report objects, or the rollout reads as keys")
	assert.Equal(t, 1, keys.called, "the keys path is tried first")
	assert.Equal(t, []string{"from-full-list"}, names(t, objs), "the full list served the tick")
}

// Any other failure is real and has to surface: swallowing it would hide an
// outage behind a silently more expensive list.
func TestConnectionList_SurfacesOtherErrors(t *testing.T) {
	boom := errors.New("storage unavailable")
	keys := &stubKeysLister{err: boom}
	client := fake.NewClientset(conn(testNamespace, "from-full-list"))

	var seen []bool
	objs, _, err := connectionList(client.ProvisioningV0alpha1(), testNamespace, keys, recordProjection(&seen))(t.Context())
	require.ErrorIs(t, err, boom)
	assert.Empty(t, seen, "a failed tick used no projection")
	assert.Nil(t, objs, "a failed tick must not deliver a partial set, which the Store would read as deletions")
}

// The setting off, and the operator, both arrive here as a nil lister.
func TestConnectionList_NilListerUsesFullObjects(t *testing.T) {
	client := fake.NewClientset(conn(testNamespace, "a"), conn(testNamespace, "b"))

	objs, _, err := connectionList(client.ProvisioningV0alpha1(), testNamespace, nil, nil)(t.Context())
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"a", "b"}, names(t, objs))
}

// The rollout is read off this counter, so the labels it reports are part of the
// contract: a dashboard filtering projection="keys" has to see the keys path and
// only the keys path.
func TestRelistProjectionRecorder_ReportsTheProjection(t *testing.T) {
	reg := prometheus.NewRegistry()
	// The job delta source already owns the delivery metrics on this registry; the
	// projection counter is the connection re-list's own, so it does not collide.
	_ = newInformerMetrics(reg)
	record := newRelistProjectionRecorder(reg, "connections")

	record(true)
	record(true)
	record(false)

	assert.Equal(t, float64(2), projectionCount(t, reg, "keys"))
	assert.Equal(t, float64(1), projectionCount(t, reg, "objects"))
}

func projectionCount(t *testing.T, reg *prometheus.Registry, projection string) float64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)

	for _, mf := range families {
		if mf.GetName() != "grafana_provisioning_informer_relist_projection_total" {
			continue
		}
		for _, m := range mf.GetMetric() {
			for _, l := range m.GetLabel() {
				if l.GetName() == "projection" && l.GetValue() == projection {
					return m.GetCounter().GetValue()
				}
			}
		}
	}
	return 0
}

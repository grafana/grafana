package resource

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type docListIterator struct {
	values [][]byte
	pos    int
}

func (i *docListIterator) Next() bool {
	i.pos++
	return i.pos <= len(i.values)
}
func (i *docListIterator) Error() error           { return nil }
func (i *docListIterator) ContinueToken() string  { return "" }
func (i *docListIterator) ResourceVersion() int64 { return int64(i.pos) }
func (i *docListIterator) Namespace() string      { return "ns" }
func (i *docListIterator) Name() string           { return "name" }
func (i *docListIterator) Folder() string         { return "" }
func (i *docListIterator) Value() []byte          { return i.values[i.pos-1] }

type docStorageBackend struct {
	mockStorageBackend
	values [][]byte
}

func (m *docStorageBackend) ListIterator(_ context.Context, _ *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	return 1, cb(&docListIterator{values: m.values})
}

func TestBuildRecordsPhaseMetrics(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := ProvideIndexMetrics(reg)

	nsr := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	doc := []byte(`{"apiVersion":"v1","kind":"Test","metadata":{"name":"aaa","namespace":"ns"},"spec":{}}`)

	storage := &docStorageBackend{values: [][]byte{doc, doc, doc}}
	search := &mockSearchBackend{}
	opts := SearchOptions{
		Backend:      search,
		Resources:    &TestDocumentBuilderSupplier{GroupsResources: map[string]string{"group": "resource"}},
		InitMinCount: 1,
	}

	server, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, metrics, nil, nil)
	require.NoError(t, err)

	_, err = server.build(context.Background(), nsr, 3, "test", false, time.Time{})
	require.NoError(t, err)

	labels := []string{IndexPathBuild, nsr.Group, nsr.Resource}

	require.Equal(t, 3.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseFetch}, labels...)...)),
		"every document read is counted")
	require.Equal(t, 3.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseConvert}, labels...)...)),
		"every document converted is counted")
	require.Equal(t, 3.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseIndex}, labels...)...)),
		"every document handed to the index is counted")
	require.Equal(t, float64(3*len(doc)), testutil.ToFloat64(metrics.BuildSourceBytes.WithLabelValues(labels...)),
		"bytes read are the sizes of the stored objects")

	// Durations are real measurements, so only their presence is asserted.
	require.GreaterOrEqual(t, testutil.ToFloat64(metrics.BuildPhaseSeconds.WithLabelValues(append([]string{IndexPhaseConvert}, labels...)...)), 0.0)
}

func TestUpdateRecordsPhaseMetrics(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := ProvideIndexMetrics(reg)

	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	modified := func(name string, rv int64) *ModifiedResource {
		return &ModifiedResource{
			Action:          resourcepb.WatchEvent_MODIFIED,
			Key:             resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name},
			ResourceVersion: rv,
			Value:           testObjectJSON(name, name),
		}
	}

	storage := &trashStorageBackend{modified: []*ModifiedResource{modified("one", 10), modified("two", 11)}}
	search := &mockSearchBackend{}
	server, err := newSearchServer(trashSearchOptions(search), storage, nil, nil, nil, nil, nil, metrics, nil, nil)
	require.NoError(t, err)

	_, err = server.build(t.Context(), key, 1, "test", false, time.Time{})
	require.NoError(t, err)

	search.mu.Lock()
	updater := search.lastUpdater
	search.mu.Unlock()
	require.NotNil(t, updater)

	index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: IndexFeaturesForNewIndex(true)}}
	_, docs, err := updater(t.Context(), index, 1)
	require.NoError(t, err)
	require.Equal(t, 2, docs)

	labels := []string{IndexPathUpdate, key.Group, key.Resource}
	require.Equal(t, 2.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseFetch}, labels...)...)))
	require.Equal(t, 2.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseConvert}, labels...)...)))
	require.Equal(t, 2.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseIndex}, labels...)...)))
	require.Positive(t, testutil.ToFloat64(metrics.BuildSourceBytes.WithLabelValues(labels...)))
}

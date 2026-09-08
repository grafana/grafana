package resource

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestBuildPhaseRecorder(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := ProvideIndexMetrics(reg)

	nsr := NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	rec := newBuildPhaseRecorder(m, IndexPathBuild, nsr)

	// Two documents read, one of which could not be converted.
	rec.recordFetch(time.Second, 100)
	rec.recordConvert(time.Second, true)
	rec.recordFetch(time.Second, 50)
	rec.recordConvert(time.Second, false)
	rec.flush()

	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(`
# HELP index_server_build_documents_total Documents reaching each phase of building or updating an index. Fetched minus converted is how many produced nothing to give the index, and fetched minus committed is how many did not reach it.
# TYPE index_server_build_documents_total counter
index_server_build_documents_total{group="dashboard.grafana.app",path="build",phase="convert",resource="dashboards"} 1
index_server_build_documents_total{group="dashboard.grafana.app",path="build",phase="fetch",resource="dashboards"} 2
# HELP index_server_build_source_bytes_total Bytes of stored objects read while building or updating an index.
# TYPE index_server_build_source_bytes_total counter
index_server_build_source_bytes_total{group="dashboard.grafana.app",path="build",resource="dashboards"} 150
# HELP index_server_build_phase_seconds_total Seconds spent building or updating an index, by phase: fetch reads the stored object, convert turns it into a search document, map adds it to an index batch, commit writes the batch, promote moves an index that outgrew memory onto disk.
# TYPE index_server_build_phase_seconds_total counter
index_server_build_phase_seconds_total{group="dashboard.grafana.app",path="build",phase="convert",resource="dashboards"} 2
index_server_build_phase_seconds_total{group="dashboard.grafana.app",path="build",phase="fetch",resource="dashboards"} 2
`),
		"index_server_build_documents_total",
		"index_server_build_source_bytes_total",
		"index_server_build_phase_seconds_total"))

	// A second flush must not double count.
	rec.flush()
	require.Equal(t, 2.0, testutil.ToFloat64(m.BuildDocuments.WithLabelValues(IndexPhaseFetch, IndexPathBuild, nsr.Group, nsr.Resource)))
}

// A recorder without metrics measures as usual and reports nothing, so callers
// need no special case.
func TestBuildPhaseRecorderWithoutMetrics(t *testing.T) {
	rec := newBuildPhaseRecorder(nil, IndexPathBuild, NamespacedResource{})
	require.NotPanics(t, func() {
		rec.recordFetch(time.Second, 1)
		rec.recordFetchWithNoValue(time.Second)
		rec.recordConvert(time.Second, true)
		rec.flush()
	})
	require.Empty(t, rec.pathLabel(), "the index has nothing to label its own records with")
}

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
	values  [][]byte
	listErr error
}

func (m *docStorageBackend) ListIterator(_ context.Context, _ *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	if m.listErr != nil {
		time.Sleep(time.Millisecond)
		return 0, m.listErr
	}
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

	_, err = server.build(t.Context(), nsr, 3, "test", false, time.Time{})
	require.NoError(t, err)

	labels := []string{IndexPathBuild, nsr.Group, nsr.Resource}

	require.Equal(t, 3.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseFetch}, labels...)...)),
		"every document read is counted")
	require.Equal(t, 3.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseConvert}, labels...)...)),
		"every document converted is counted")
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
	require.Positive(t, testutil.ToFloat64(metrics.BuildSourceBytes.WithLabelValues(labels...)))
}

// Storage that fails before handing over an iterator still spent time doing so,
// and that time is the fetch phase.
func TestBuildRecordsFetchWhenStorageFailsEarly(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := ProvideIndexMetrics(reg)

	nsr := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	storage := &docStorageBackend{listErr: errors.New("storage is down")}
	opts := SearchOptions{
		Backend:      &mockSearchBackend{},
		Resources:    &TestDocumentBuilderSupplier{GroupsResources: map[string]string{"group": "resource"}},
		InitMinCount: 1,
	}

	server, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, metrics, nil, nil)
	require.NoError(t, err)

	_, err = server.build(t.Context(), nsr, 1, "test", false, time.Time{})
	require.Error(t, err)

	labels := []string{IndexPhaseFetch, IndexPathBuild, nsr.Group, nsr.Resource}
	require.Positive(t, testutil.ToFloat64(metrics.BuildPhaseSeconds.WithLabelValues(labels...)),
		"the failed list still took time, and it belongs to fetch")
	require.Zero(t, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(labels...)),
		"no documents arrived")
}

// An event the dedup cache has already seen needs no conversion, so it must not
// look like a dropped document.
func TestUpdateCountsDeduplicatedEventsAsConverted(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := ProvideIndexMetrics(reg)

	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	event := &ModifiedResource{
		Action:          resourcepb.WatchEvent_MODIFIED,
		Key:             resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "one"},
		ResourceVersion: 10,
		Value:           testObjectJSON("one", "One"),
	}
	storage := &trashStorageBackend{modified: []*ModifiedResource{event}}

	search := &mockSearchBackend{}
	opts := trashSearchOptions(search)
	opts.IndexModificationCacheTTL = time.Minute
	server, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, metrics, nil, nil)
	require.NoError(t, err)

	_, err = server.build(t.Context(), key, 1, "test", false, time.Time{})
	require.NoError(t, err)

	search.mu.Lock()
	updater := search.lastUpdater
	search.mu.Unlock()

	index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: IndexFeaturesForNewIndex(true)}}

	_, docs, err := updater(t.Context(), index, 1)
	require.NoError(t, err)
	require.Equal(t, 1, docs)

	// The lookback window hands the same event to the next update, where the
	// cache skips it.
	_, docs, err = updater(t.Context(), index, 1)
	require.NoError(t, err)
	require.Zero(t, docs, "the duplicate is skipped")

	labels := []string{IndexPathUpdate, key.Group, key.Resource}
	fetched := testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseFetch}, labels...)...))
	converted := testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseConvert}, labels...)...))
	require.Equal(t, 2.0, fetched, "the event was read by both updates")
	require.Equal(t, fetched, converted, "a skipped duplicate must not look like a dropped document")
}

// A delete gives the index something whether its trash marker was built, the
// marker could not be built, or the index does not keep them, so none of the
// three may look like a document that produced nothing.
func TestUpdateCountsDeletesAsConverted(t *testing.T) {
	for _, tc := range []struct {
		name        string
		keepDeleted bool
		value       []byte
	}{
		{name: "trash kept", keepDeleted: true, value: testObjectJSON("gone", "Gone")},
		{name: "trash off", keepDeleted: false, value: testObjectJSON("gone", "Gone")},
		{name: "trash kept but body unusable", keepDeleted: true, value: []byte("not json")},
	} {
		keepDeleted, value := tc.keepDeleted, tc.value
		t.Run(tc.name, func(t *testing.T) {
			reg := prometheus.NewPedanticRegistry()
			metrics := ProvideIndexMetrics(reg)

			key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
			storage := &trashStorageBackend{modified: []*ModifiedResource{{
				Action:          resourcepb.WatchEvent_DELETED,
				Key:             resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "gone"},
				ResourceVersion: 10,
				Value:           value,
			}}}

			search := &mockSearchBackend{}
			opts := trashSearchOptions(search)
			search.keepsDeletedDocuments = keepDeleted
			server, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, metrics, nil, nil)
			require.NoError(t, err)

			_, err = server.build(t.Context(), key, 1, "test", false, time.Time{})
			require.NoError(t, err)

			search.mu.Lock()
			updater := search.lastUpdater
			search.mu.Unlock()

			index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: IndexFeaturesForNewIndex(keepDeleted)}}
			_, _, err = updater(t.Context(), index, 1)
			require.NoError(t, err)

			labels := []string{IndexPathUpdate, key.Group, key.Resource}
			fetched := testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseFetch}, labels...)...))
			converted := testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{IndexPhaseConvert}, labels...)...))
			require.Equal(t, 1.0, fetched)
			require.Equal(t, fetched, converted, "a delete always gives the index something")
		})
	}
}

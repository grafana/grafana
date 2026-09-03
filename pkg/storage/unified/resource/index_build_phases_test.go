package resource

import (
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
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
	rec.recordIndexed(1)
	rec.flush()

	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(`
# HELP index_server_build_documents_total Documents reaching each phase of building or updating an index. Fetched minus converted is how many were dropped.
# TYPE index_server_build_documents_total counter
index_server_build_documents_total{group="dashboard.grafana.app",path="build",phase="convert",resource="dashboards"} 1
index_server_build_documents_total{group="dashboard.grafana.app",path="build",phase="fetch",resource="dashboards"} 2
index_server_build_documents_total{group="dashboard.grafana.app",path="build",phase="index",resource="dashboards"} 1
# HELP index_server_build_source_bytes_total Bytes of stored objects read while building or updating an index.
# TYPE index_server_build_source_bytes_total counter
index_server_build_source_bytes_total{group="dashboard.grafana.app",path="build",resource="dashboards"} 150
# HELP index_server_build_phase_seconds_total Seconds spent building or updating an index, by phase: fetch reads the stored object, convert turns it into a search document, map adds it to an index batch, commit writes the batch.
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
		rec.recordIndexed(1)
		rec.flush()
	})
	require.Empty(t, rec.pathLabel(), "the index has nothing to label its own records with")
}

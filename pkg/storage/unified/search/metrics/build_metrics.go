package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	// IndexPhaseFetch reads the stored object.
	IndexPhaseFetch = "fetch"
	// IndexPhaseConvert turns it into a search document.
	IndexPhaseConvert = "convert"
	// IndexPhaseMap adds it to a batch, which maps it onto the index schema.
	IndexPhaseMap = "map"
	// IndexPhaseCommit writes the batch, which is where a file-backed index pays
	// for disk. Documents in this phase are the ones the write accepted.
	IndexPhaseCommit = "commit"
	// IndexPhasePromote copies an index that has outgrown memory onto disk, which
	// happens once during a build and costs more the later it happens.
	IndexPhasePromote = "promote"
)

const (
	IndexPathBuild  = "build"
	IndexPathUpdate = "update"
	IndexPathTrash  = "trash"
)

// BuildMetrics is shared because service and backend contribute different phases to the same families.
type BuildMetrics struct {
	BuildPhaseSeconds *prometheus.CounterVec
	BuildDocuments    *prometheus.CounterVec
}

func ProvideBuildMetrics(reg prometheus.Registerer) *BuildMetrics {
	m := &BuildMetrics{
		BuildPhaseSeconds: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_index_server_build_phase_seconds_total",
			Help: "Seconds spent building or updating an index, by phase: fetch reads the stored object, convert turns it into a search document, map adds it to an index batch, commit writes the batch, promote moves an index that outgrew memory onto disk.",
		}, []string{"phase", "path", "group", "resource"}),
		BuildDocuments: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_index_server_build_documents_total",
			Help: "Documents reaching each phase of building or updating an index. Fetched minus converted is how many produced nothing to give the index, and fetched minus committed is how many did not reach it.",
		}, []string{"phase", "path", "group", "resource"}),
	}
	return m
}

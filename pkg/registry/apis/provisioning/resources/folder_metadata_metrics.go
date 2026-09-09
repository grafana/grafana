package resources

import (
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// Folder metadata read outcomes. found means _folder.json was read and parsed
// into a usable folder identity; missing means the folder has no _folder.json,
// an expected state (not a failure) that leaves the folder UID hash-derived and
// unstable; invalid means a _folder.json exists but could not be parsed or lacks
// an identity; error covers any other read failure.
const (
	folderReadOutcomeFound   = "found"
	folderReadOutcomeMissing = "missing"
	folderReadOutcomeInvalid = "invalid"
	folderReadOutcomeError   = "error"
)

// FolderMetadataMetrics tracks reads of _folder.json files. These sit on the
// sync hot path — every folder is read to resolve its stable UID — and their
// outcome mirrors the folder-metadata health reasons (missing/invalid), so the
// breakdown is worth its own series rather than folding into the generic
// repository read metric, where "missing" would masquerade as an error.
type FolderMetadataMetrics struct {
	readsTotal   *prometheus.CounterVec   // repository_type, outcome
	readDuration *prometheus.HistogramVec // repository_type
}

var (
	folderMetadataMetricsOnce sync.Once
	folderMetadataMetrics     *FolderMetadataMetrics
)

// RegisterFolderMetadataMetrics registers the folder metadata read metrics and
// stores them in a package singleton so ReadFolderMetadata — a free function
// called from the parser, folder manager, dual writer and sync without access
// to the registry — can record to them without threading a recorder through
// every caller.
func RegisterFolderMetadataMetrics(reg prometheus.Registerer) *FolderMetadataMetrics {
	folderMetadataMetricsOnce.Do(func() {
		folderMetadataMetrics = newFolderMetadataMetrics(reg)
	})
	return folderMetadataMetrics
}

// newFolderMetadataMetrics builds and registers the metrics on reg without
// touching the package singleton, so tests can exercise recording against an
// isolated registry.
func newFolderMetadataMetrics(reg prometheus.Registerer) *FolderMetadataMetrics {
	readsTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_folder_metadata_reads_total",
			Help: "Total _folder.json reads, by outcome (found, missing, invalid, error)",
		},
		[]string{"repository_type", "outcome"},
	)
	reg.MustRegister(readsTotal)

	readDuration := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_folder_metadata_read_duration_seconds",
			Help:    "Duration of _folder.json reads",
			Buckets: prometheus.ExponentialBucketsRange(0.001, 30, 10), // 1ms -> 30s
		},
		[]string{"repository_type"},
	)
	reg.MustRegister(readDuration)

	return &FolderMetadataMetrics{
		readsTotal:   readsTotal,
		readDuration: readDuration,
	}
}

// recordRead records a folder metadata read that started at start. A nil
// receiver records nothing (and never touches repo), so ReadFolderMetadata works
// unchanged when the metrics were never registered (tests, dev tooling). The
// repository type is resolved from repo only on the recording path.
func (m *FolderMetadataMetrics) recordRead(repo repository.Reader, start time.Time, err error) {
	if m == nil {
		return
	}
	repoType := string(repo.Config().Spec.Type)
	m.readsTotal.WithLabelValues(repoType, folderReadOutcome(err)).Inc()
	m.readDuration.WithLabelValues(repoType).Observe(time.Since(start).Seconds())
}

// folderReadOutcome classifies the result of a folder metadata read. A missing
// _folder.json is reported as its own outcome rather than an error because it is
// an expected state when folder metadata is disabled or a folder predates it.
func folderReadOutcome(err error) string {
	switch {
	case err == nil:
		return folderReadOutcomeFound
	case errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err):
		return folderReadOutcomeMissing
	case errors.Is(err, ErrInvalidFolderMetadata):
		return folderReadOutcomeInvalid
	default:
		return folderReadOutcomeError
	}
}

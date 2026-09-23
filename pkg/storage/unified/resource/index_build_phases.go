package resource

import (
	"iter"
	"time"
)

// buildPhaseRecorder measures where the time goes while an index is built or
// updated. Totals are accumulated here and pushed to the metrics once per
// batch, so a million documents cost a handful of counter operations.
//
// The recorder works without metrics, so callers need no special case.
type buildPhaseRecorder struct {
	metrics  *BleveIndexMetrics
	path     string
	group    string
	resource string

	fetch       time.Duration
	convert     time.Duration
	fetched     int
	converted   int
	sourceBytes int64
}

func newBuildPhaseRecorder(metrics *BleveIndexMetrics, path string, nsr NamespacedResource) *buildPhaseRecorder {
	return &buildPhaseRecorder{
		metrics:  metrics,
		path:     path,
		group:    nsr.Group,
		resource: nsr.Resource,
	}
}

// pathLabel lets the index label what it records with the same path as the
// caller. Empty when nothing is being measured.
func (r *buildPhaseRecorder) pathLabel() string {
	if r.metrics == nil {
		return ""
	}
	return r.path
}

func (r *buildPhaseRecorder) recordFetch(d time.Duration, bytes int) {
	r.fetch += d
	r.fetched++
	r.sourceBytes += int64(bytes)
}

// recordFetchWithNoValue counts a read that returned nothing, such as the one
// that reports the end of the list.
func (r *buildPhaseRecorder) recordFetchWithNoValue(d time.Duration) {
	r.fetch += d
}

// recordConvert counts an attempt to build a search document. Only attempts
// that produced something for the index add to the converted total, so fetched
// minus converted is how many documents produced nothing.
func (r *buildPhaseRecorder) recordConvert(d time.Duration, produced bool) {
	r.convert += d
	if produced {
		r.converted++
	}
}

// recordConvertNotNeeded counts a document that needs no search document, such
// as a delete when the index does not keep deleted documents, so it is not
// mistaken for one that produced nothing.
func (r *buildPhaseRecorder) recordConvertNotNeeded() {
	r.converted++
}

// timeModifiedResources reports the time the sequence spends producing each
// resource. The clock restarts once the loop body has run, whichever way it
// left, so a body that skips an item cannot charge its own work to the fetch.
// The time after the last resource counts too, which for a sequence that yields
// nothing is all of it.
func (r *buildPhaseRecorder) timeModifiedResources(seq iter.Seq2[*ModifiedResource, error]) iter.Seq2[*ModifiedResource, error] {
	return func(yield func(*ModifiedResource, error) bool) {
		start := time.Now()
		seq(func(res *ModifiedResource, err error) bool {
			elapsed := time.Since(start)
			// Storage reports its failures with an empty resource, so only count a
			// document when one actually arrived.
			if res != nil && err == nil {
				r.recordFetch(elapsed, len(res.Value))
			} else {
				r.recordFetchWithNoValue(elapsed)
			}

			ok := yield(res, err)
			start = time.Now()
			return ok
		})
		r.recordFetchWithNoValue(time.Since(start))
	}
}

// flush reports what has been accumulated and starts again. Call it after each
// batch, and once when the loop ends.
func (r *buildPhaseRecorder) flush() {
	if r.metrics == nil {
		return
	}

	if r.fetch > 0 {
		r.metrics.BuildPhaseSeconds.WithLabelValues(IndexPhaseFetch, r.path, r.group, r.resource).Add(r.fetch.Seconds())
	}
	if r.convert > 0 {
		r.metrics.BuildPhaseSeconds.WithLabelValues(IndexPhaseConvert, r.path, r.group, r.resource).Add(r.convert.Seconds())
	}
	if r.fetched > 0 {
		r.metrics.BuildDocuments.WithLabelValues(IndexPhaseFetch, r.path, r.group, r.resource).Add(float64(r.fetched))
	}
	if r.converted > 0 {
		r.metrics.BuildDocuments.WithLabelValues(IndexPhaseConvert, r.path, r.group, r.resource).Add(float64(r.converted))
	}
	if r.sourceBytes > 0 {
		r.metrics.BuildSourceBytes.WithLabelValues(r.path, r.group, r.resource).Add(float64(r.sourceBytes))
	}

	r.fetch, r.convert = 0, 0
	r.fetched, r.converted = 0, 0
	r.sourceBytes = 0
}

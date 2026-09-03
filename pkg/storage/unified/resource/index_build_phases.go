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
	indexed     int
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

// recordConvert counts an attempt to build a search document. Only successful
// attempts add to the converted total, so fetched minus converted is how many
// documents were dropped.
func (r *buildPhaseRecorder) recordConvert(d time.Duration, ok bool) {
	r.convert += d
	if ok {
		r.converted++
	}
}

func (r *buildPhaseRecorder) recordIndexed(count int) {
	r.indexed += count
}

// timeModifiedResources reports the time the sequence spends producing each
// resource. The clock restarts once the loop body has run, whichever way it
// left, so a body that skips an item cannot charge its own work to the fetch.
func (r *buildPhaseRecorder) timeModifiedResources(seq iter.Seq2[*ModifiedResource, error]) iter.Seq2[*ModifiedResource, error] {
	return func(yield func(*ModifiedResource, error) bool) {
		start := time.Now()
		seq(func(res *ModifiedResource, err error) bool {
			elapsed := time.Since(start)
			if res != nil {
				r.recordFetch(elapsed, len(res.Value))
			} else {
				r.recordFetchWithNoValue(elapsed)
			}

			ok := yield(res, err)
			start = time.Now()
			return ok
		})
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
	if r.indexed > 0 {
		r.metrics.BuildDocuments.WithLabelValues(IndexPhaseIndex, r.path, r.group, r.resource).Add(float64(r.indexed))
	}
	if r.sourceBytes > 0 {
		r.metrics.BuildSourceBytes.WithLabelValues(r.path, r.group, r.resource).Add(float64(r.sourceBytes))
	}

	r.fetch, r.convert = 0, 0
	r.fetched, r.converted, r.indexed = 0, 0, 0
	r.sourceBytes = 0
}

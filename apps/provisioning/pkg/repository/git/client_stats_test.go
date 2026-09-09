package git

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/nanogit/metrics"
)

// TestClientStats_AccumulatesFromRecorder pins the seam that makes per-job stats
// work: the same client recorder that feeds the fleet counters also folds each
// event into the ClientStats attached to the context it is handed, so a job that
// scopes a context with WithJobStats gets the git work of that one run.
func TestClientStats_AccumulatesFromRecorder(t *testing.T) {
	rec := newClientMetrics(prometheus.NewRegistry()).Recorder(provisioning.GitRepositoryType)

	ctx, stats := WithJobStats(context.Background())

	rec.HTTPRequest(ctx, metrics.HTTPRequestSample{Operation: metrics.OperationUploadPack, StatusCode: 200, Duration: time.Millisecond, Attempt: 1})
	rec.HTTPRequest(ctx, metrics.HTTPRequestSample{Operation: metrics.OperationUploadPack, StatusCode: 500, Duration: time.Millisecond, Attempt: 2}) // a retry
	rec.ObjectsFetched(ctx, metrics.ObjectsFetchedSample{Count: 12, Bytes: 3456})
	rec.ObjectsFetched(ctx, metrics.ObjectsFetchedSample{Count: 3, Bytes: 44})
	rec.CacheAccess(ctx, metrics.CacheAccessSample{Hit: true})
	rec.CacheAccess(ctx, metrics.CacheAccessSample{Hit: true})
	rec.CacheAccess(ctx, metrics.CacheAccessSample{Hit: false})

	assert.Equal(t, ClientStatsSnapshot{
		HTTPRequests:   2,
		HTTPRetries:    1,
		ObjectsFetched: 15,
		BytesFetched:   3500,
		CacheHits:      2,
		CacheMisses:    1,
	}, stats.Snapshot())
}

// A recorder handed a context with no stats attached must simply not record any,
// so instrumentation outside a job (health checks, tests, ad-hoc calls) is a
// no-op rather than a panic.
func TestClientStats_NoStatsInContextIsNoop(t *testing.T) {
	rec := newClientMetrics(prometheus.NewRegistry()).Recorder(provisioning.GitRepositoryType)

	assert.NotPanics(t, func() {
		rec.HTTPRequest(context.Background(), metrics.HTTPRequestSample{Operation: metrics.OperationSmartInfo, StatusCode: 200, Attempt: 1})
		rec.ObjectsFetched(context.Background(), metrics.ObjectsFetchedSample{Count: 1, Bytes: 1})
		rec.CacheAccess(context.Background(), metrics.CacheAccessSample{Hit: true})
	})
}

// The zero value of a freshly scoped context reads as all-zero, which is how a
// job that did no git work (or ran on a local repository) reports.
func TestClientStats_ZeroWhenNoWork(t *testing.T) {
	_, stats := WithJobStats(context.Background())
	assert.Equal(t, ClientStatsSnapshot{}, stats.Snapshot())
}

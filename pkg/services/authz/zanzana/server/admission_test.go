package server

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/semaphore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/setting"
)

func newTestServerWithLimits(maxGlobal, maxPerNS int) *Server {
	cfg := setting.ZanzanaServerSettings{
		MaxConcurrentRequests:             maxGlobal,
		MaxConcurrentRequestsPerNamespace: maxPerNS,
	}

	s := &Server{
		cfg:           cfg,
		metrics:       newZanzanaServerMetrics(prometheus.NewRegistry()),
		nsLimiterSize: int64(maxPerNS),
	}

	if maxGlobal > 0 {
		s.globalSem = semaphore.NewWeighted(int64(maxGlobal))
	}

	return s
}

func TestAcquireSlot_Disabled(t *testing.T) {
	s := newTestServerWithLimits(0, 0)

	for i := 0; i < 100; i++ {
		release, err := s.acquireSlot("Check", "ns-a")
		require.NoError(t, err)
		defer release()
	}
}

func TestAcquireSlot_GlobalLimit(t *testing.T) {
	s := newTestServerWithLimits(2, 0)

	r1, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)

	r2, err := s.acquireSlot("Check", "ns-b")
	require.NoError(t, err)

	// 3rd should fail
	_, err = s.acquireSlot("Check", "ns-c")
	require.Error(t, err)
	assert.Equal(t, codes.ResourceExhausted, status.Code(err))
	assert.Contains(t, err.Error(), "server concurrency limit reached")

	// Release one, next should succeed
	r1()
	r3, err := s.acquireSlot("Check", "ns-c")
	require.NoError(t, err)
	r2()
	r3()
}

func TestAcquireSlot_NamespaceLimit(t *testing.T) {
	s := newTestServerWithLimits(10, 1)

	r1, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)

	// 2nd for same namespace should fail
	_, err = s.acquireSlot("Check", "ns-a")
	require.Error(t, err)
	assert.Equal(t, codes.ResourceExhausted, status.Code(err))
	assert.Contains(t, err.Error(), "namespace concurrency limit reached")

	// Different namespace should succeed
	r2, err := s.acquireSlot("Check", "ns-b")
	require.NoError(t, err)

	r1()
	r2()
}

func TestAcquireSlot_GlobalBeforeNamespace(t *testing.T) {
	s := newTestServerWithLimits(1, 5)

	r1, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)

	// Different namespace also fails — global is full
	_, err = s.acquireSlot("Check", "ns-b")
	require.Error(t, err)
	assert.Equal(t, codes.ResourceExhausted, status.Code(err))
	assert.Contains(t, err.Error(), "server concurrency limit reached")

	r1()
}

func TestAcquireSlot_ReleaseRestoresBoth(t *testing.T) {
	s := newTestServerWithLimits(1, 1)

	release, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)

	// Both global and namespace are full
	_, err = s.acquireSlot("Check", "ns-a")
	require.Error(t, err)

	_, err = s.acquireSlot("Check", "ns-b")
	require.Error(t, err)

	// After release, both should be available again
	release()

	r1, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)
	r1()
}

func TestAcquireSlot_ReleaseIsIdempotent(t *testing.T) {
	s := newTestServerWithLimits(1, 1)

	release, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)

	// Calling release multiple times should not panic or double-release
	release()
	release()
	release()

	// Should still be able to acquire
	r, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)
	r()
}

func TestAcquireSlot_MetricsIncDec(t *testing.T) {
	s := newTestServerWithLimits(10, 0)

	release, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)

	assert.Equal(t, 1.0, testutil.ToFloat64(s.metrics.inflightRequests.WithLabelValues("Check")))

	release()

	assert.Equal(t, 0.0, testutil.ToFloat64(s.metrics.inflightRequests.WithLabelValues("Check")))
}

func TestAcquireSlot_RejectionMetrics(t *testing.T) {
	s := newTestServerWithLimits(1, 0)

	r, err := s.acquireSlot("Check", "ns-a")
	require.NoError(t, err)

	_, err = s.acquireSlot("Check", "ns-b")
	require.Error(t, err)

	assert.Equal(t, 1.0, testutil.ToFloat64(s.metrics.rejectedRequests.WithLabelValues("Check", "global")))

	r()
}

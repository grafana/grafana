package unified

import (
	"context"
	"net"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// retryTestMaxAttempts is the total number of times a failing unary call reaches
// the server: the initial call plus the retries configured in grpcConn.
//
// go-grpc-middleware counts the initial call as attempt 0 (no backoff) and only
// retries while attempt < WithMax(N). With retryConfig.Max = 3 (client.go) that
// is 3 total attempts = 1 initial + 2 retries, waiting ~1s then ~2s in between.
// Keep this in sync with retryConfig.Max.
const retryTestMaxAttempts = 3

// retryFakeServer answers every RPC through grpc's UnknownServiceHandler so we
// can exercise the client retry interceptor against injected gRPC status codes
// without standing up a real storage backend. It records per-call receive
// timestamps so tests can reason about retry amplification and jitter.
type retryFakeServer struct {
	failCode  codes.Code
	failAll   bool // return failCode for every call
	failFirst int  // return failCode for the first N calls, then succeed

	mu        sync.Mutex
	calls     int
	callTimes []time.Time
}

func (s *retryFakeServer) handle(_ any, stream grpc.ServerStream) error {
	s.mu.Lock()
	s.calls++
	n := s.calls
	s.callTimes = append(s.callTimes, time.Now())
	fail := s.failAll || n <= s.failFirst
	code := s.failCode
	s.mu.Unlock()

	if fail {
		return status.Error(code, "injected failure")
	}

	// Drain the request and reply so the unary call completes successfully and
	// the client's retry loop stops.
	_ = stream.RecvMsg(&resourcepb.ReadRequest{})
	return stream.SendMsg(&resourcepb.ReadResponse{})
}

func (s *retryFakeServer) totalCalls() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

func (s *retryFakeServer) times() []time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]time.Time, len(s.callTimes))
	copy(out, s.callTimes)
	return out
}

func startRetryFakeServer(t *testing.T, s *retryFakeServer) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	srv := grpc.NewServer(grpc.UnknownServiceHandler(s.handle))
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)
	return lis.Addr().String()
}

// dialRetryClient dials the real production client (GrpcConn wires the retry
// interceptor, backoff and jitter) and returns its own registry so retry
// metrics can be inspected in isolation.
func dialRetryClient(t *testing.T, addr string) (resourcepb.ResourceStoreClient, *prometheus.Registry) {
	t.Helper()
	reg := prometheus.NewRegistry()
	conn, err := GrpcConn(addr, reg)
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	return resourcepb.NewResourceStoreClient(conn), reg
}

func retryMetricCount(t *testing.T, reg *prometheus.Registry) float64 {
	t.Helper()
	mfs, err := reg.Gather()
	require.NoError(t, err)
	var total float64
	for _, mf := range mfs {
		if mf.GetName() != "resource_server_client_request_retries_total" {
			continue
		}
		for _, m := range mf.GetMetric() {
			total += m.GetCounter().GetValue()
		}
	}
	return total
}

// TestIntegrationClientRetry_Codes verifies end-to-end (real gRPC client and
// server, real status-code propagation) that the retry interceptor retries the
// transient codes we rely on -- Unavailable, ResourceExhausted, Aborted -- and
// only those codes, and that the retry metric tracks the attempts.
func TestIntegrationClientRetry_Codes(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name        string
		failCode    codes.Code
		failAll     bool
		failFirst   int
		wantCalls   int
		wantRetries float64
		wantErrCode codes.Code // codes.OK => success expected
	}{
		{
			name:        "Unavailable is retried until it succeeds",
			failCode:    codes.Unavailable,
			failFirst:   retryTestMaxAttempts - 1,
			wantCalls:   retryTestMaxAttempts,
			wantRetries: retryTestMaxAttempts - 1,
			wantErrCode: codes.OK,
		},
		{
			name:        "ResourceExhausted is retried until it succeeds",
			failCode:    codes.ResourceExhausted,
			failFirst:   retryTestMaxAttempts - 1,
			wantCalls:   retryTestMaxAttempts,
			wantRetries: retryTestMaxAttempts - 1,
			wantErrCode: codes.OK,
		},
		{
			name:        "Aborted is retried until it succeeds",
			failCode:    codes.Aborted,
			failFirst:   retryTestMaxAttempts - 1,
			wantCalls:   retryTestMaxAttempts,
			wantRetries: retryTestMaxAttempts - 1,
			wantErrCode: codes.OK,
		},
		{
			name:        "retries are exhausted and the final error is returned",
			failCode:    codes.Unavailable,
			failAll:     true,
			wantCalls:   retryTestMaxAttempts,
			wantRetries: retryTestMaxAttempts - 1,
			wantErrCode: codes.Unavailable,
		},
		{
			name:        "non-retryable code is returned immediately without retry",
			failCode:    codes.InvalidArgument,
			failAll:     true,
			wantCalls:   1,
			wantRetries: 0,
			wantErrCode: codes.InvalidArgument,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			srv := &retryFakeServer{failCode: tc.failCode, failAll: tc.failAll, failFirst: tc.failFirst}
			addr := startRetryFakeServer(t, srv)
			client, reg := dialRetryClient(t, addr)

			_, err := client.Read(context.Background(), &resourcepb.ReadRequest{})

			if tc.wantErrCode == codes.OK {
				require.NoError(t, err)
			} else {
				require.Equal(t, tc.wantErrCode, status.Code(err), "unexpected final error code")
			}
			require.Equal(t, tc.wantCalls, srv.totalCalls(), "unexpected number of server calls")
			require.Equal(t, tc.wantRetries, retryMetricCount(t, reg), "unexpected retry metric count")
		})
	}
}

// TestIntegrationClientRetry_MultiReplicaLoadAmplification simulates many
// concurrent Grafana replicas hitting a storage backend that is shedding load
// (always ResourceExhausted). It documents the load the retry policy adds under
// that failure mode and shows that backoff and jitter keep it bounded and
// spread out rather than turning into a synchronized retry storm against the DB.
func TestIntegrationClientRetry_MultiReplicaLoadAmplification(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const replicas = 16

	srv := &retryFakeServer{failCode: codes.ResourceExhausted, failAll: true}
	addr := startRetryFakeServer(t, srv)

	// Dial independent clients (one per simulated replica) on the main goroutine
	// so require/cleanup calls stay off the worker goroutines.
	clients := make([]resourcepb.ResourceStoreClient, replicas)
	for i := range clients {
		c, _ := dialRetryClient(t, addr)
		clients[i] = c
	}

	start := time.Now()
	var wg sync.WaitGroup
	for _, c := range clients {
		wg.Add(1)
		go func(c resourcepb.ResourceStoreClient) {
			defer wg.Done()
			_, _ = c.Read(context.Background(), &resourcepb.ReadRequest{})
		}(c)
	}
	wg.Wait()
	elapsed := time.Since(start)

	total := srv.totalCalls()
	times := srv.times()
	clusters := countArrivalClusters(times, 50*time.Millisecond)
	finalWaveSpread := lastWaveSpread(times, replicas)
	t.Logf("replicas=%d totalCalls=%d amplification=%.1fx elapsed=%s arrivalClusters=%d finalWaveSpread=%s",
		replicas, total, float64(total)/float64(replicas), elapsed, clusters, finalWaveSpread)

	// 1) Amplification is bounded. N replicas each retrying a fixed number of
	//    times generate exactly N*maxAttempts backend calls -- never an
	//    unbounded storm, even while every call keeps failing.
	require.Equal(t, replicas*retryTestMaxAttempts, total,
		"retry amplification must be bounded to maxAttempts per request")

	// 2) Backoff throttles the extra load over time instead of firing all
	//    retries instantly. With a 1s base exponential backoff the retry waves
	//    (~1s then ~2s) cannot complete in under ~3s.
	require.Greater(t, elapsed, 2*time.Second,
		"backoff should spread retries over seconds, not issue them instantly")

	// 3) Jitter de-synchronizes the replicas. Without jitter all replicas would
	//    hit the backend in maxAttempts tight simultaneous waves; jitter spreads
	//    each wave out in time so they don't all land at once.
	require.Greater(t, finalWaveSpread, 20*time.Millisecond,
		"jitter should spread retries within a wave")
	require.Greater(t, clusters, retryTestMaxAttempts,
		"jitter should produce more arrival clusters than synchronized retry waves")
}

// countArrivalClusters counts groups of arrivals separated by more than window.
// Perfectly synchronized retry waves collapse into one cluster each; jitter
// splits them into more.
func countArrivalClusters(times []time.Time, window time.Duration) int {
	if len(times) == 0 {
		return 0
	}
	sorted := sortedTimes(times)
	clusters := 1
	for i := 1; i < len(sorted); i++ {
		if sorted[i].Sub(sorted[i-1]) > window {
			clusters++
		}
	}
	return clusters
}

// lastWaveSpread returns the time between the first and last arrival of the
// final retry wave (the last waveSize arrivals), which reflects the jitter
// applied to the largest backoff interval.
func lastWaveSpread(times []time.Time, waveSize int) time.Duration {
	if len(times) < waveSize || waveSize < 1 {
		return 0
	}
	sorted := sortedTimes(times)
	wave := sorted[len(sorted)-waveSize:]
	return wave[len(wave)-1].Sub(wave[0])
}

func sortedTimes(times []time.Time) []time.Time {
	sorted := make([]time.Time, len(times))
	copy(sorted, times)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Before(sorted[j]) })
	return sorted
}

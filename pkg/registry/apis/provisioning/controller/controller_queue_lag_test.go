package controller

import (
	"context"
	"errors"
	"net"
	"net/url"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/workqueue"
	testingclock "k8s.io/utils/clock/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

const queueLagTestKey = "ns/key"

type queueLagControllerTest struct {
	tracker     *queueLagTracker
	queue       workqueue.TypedRateLimitingInterface[string]
	limiter     workqueue.TypedRateLimiter[string]
	clock       *testingclock.FakeClock
	enqueue     func()
	processNext func() bool
	gauge       func() float64
	waitSamples func() (uint64, float64)
}

func newQueueLagControllerTest(t *testing.T, component string, process func() error) *queueLagControllerTest {
	t.Helper()
	reg := prometheus.NewPedanticRegistry()
	queueReg := prometheus.NewPedanticRegistry()
	clock := testingclock.NewFakeClock(time.Now())
	limiter := workqueue.DefaultTypedControllerRateLimiter[string]()
	queue := workqueue.NewTypedRateLimitingQueueWithConfig(
		limiter,
		workqueue.TypedRateLimitingQueueConfig[string]{
			Name:            "queue-lag-test",
			Clock:           clock,
			MetricsProvider: newWorkerQueueWaitProvider(queueReg, component),
		},
	)
	t.Cleanup(queue.ShutDown)
	c := &queueLagControllerTest{
		queue:   queue,
		limiter: limiter,
		clock:   clock,
		gauge: func() float64 {
			return gaugeValueByName(t, reg, "grafana_provisioning_"+component+"_worker_queue_lag_seconds")
		},
		waitSamples: func() (uint64, float64) {
			family := gatherMetrics(t, queueReg)["grafana_provisioning_"+component+"_worker_queue_wait_seconds"]
			require.NotNil(t, family)
			require.Len(t, family.GetMetric(), 1)
			histogram := family.GetMetric()[0].GetHistogram()
			return histogram.GetSampleCount(), histogram.GetSampleSum()
		},
	}
	meta := metav1.ObjectMeta{Namespace: "ns", Name: "key"}
	switch component {
	case "repository":
		rc := NewRepositoryController(
			nil, nil, nil, nil, nil, nil, nil, nil, nil, reg, nil, 1,
			time.Minute, time.Minute, 5*time.Second, nil, nil,
			repository.IncrementalSyncPolicy{}, time.Minute, false,
		)
		rc.queue.ShutDown()
		rc.queue = queue
		rc.processFn = func(string) (string, error) { return "", process() }
		c.tracker = &rc.queueLag
		repo := &provisioning.Repository{ObjectMeta: meta}
		c.enqueue = func() { rc.EventHandler().UpdateFunc(repo, repo) }
		c.processNext = func() bool { return rc.processNextWorkItem(t.Context()) }
	case "connection":
		cc := NewConnectionController(nil, nil, nil, nil, time.Minute, 5*time.Second, reg, nil, false)
		cc.queue.ShutDown()
		cc.queue = queue
		cc.processFn = func(_ context.Context, _ string) error { return process() }
		c.tracker = &cc.queueLag
		conn := &provisioning.Connection{ObjectMeta: meta}
		c.enqueue = func() { cc.EventHandler().UpdateFunc(conn, conn) }
		c.processNext = func() bool { return cc.processNextWorkItem(t.Context()) }
	default:
		t.Fatalf("unknown controller %q", component)
	}
	return c
}

func (c *queueLagControllerTest) advance(d time.Duration) {
	time.Sleep(d)
	c.clock.Step(d)
	synctest.Wait()
}

func TestControllerQueueLagRetries(t *testing.T) {
	unavailable := apierrors.NewServiceUnavailable("temporarily unavailable")
	terminal := errors.New("invalid configuration")
	for _, component := range []string{"repository", "connection"} {
		for _, tt := range []struct {
			name      string
			results   []error
			reenqueue bool
		}{
			{name: "retry succeeds", results: []error{unavailable, nil}},
			{name: "retries exhausted", results: []error{unavailable, unavailable, unavailable}},
			{name: "terminal failure", results: []error{terminal}},
			{name: "retry fails permanently", results: []error{unavailable, terminal}},
			{name: "retry after informer update", results: []error{unavailable, nil}, reenqueue: true},
		} {
			t.Run(component+"/"+tt.name, func(t *testing.T) {
				var completedAt time.Time
				var pendingAt time.Time
				attempt := 0
				var c *queueLagControllerTest
				c = newQueueLagControllerTest(t, component, func() error {
					require.Less(t, attempt, len(tt.results))
					if attempt == 0 && tt.reenqueue {
						updated := make(chan struct{})
						go func() {
							c.enqueue()
							close(updated)
						}()
						<-updated
						pendingAt = c.tracker.waiting[queueLagTestKey].Value.(time.Time)
					}
					err := tt.results[attempt]
					attempt++
					completedAt = time.Now()
					return err
				})
				c.enqueue()
				for i := range tt.results {
					require.True(t, c.processNext())
					assert.Empty(t, c.tracker.inflight)
					if i < len(tt.results)-1 {
						require.Contains(t, c.tracker.waiting, queueLagTestKey)
						enqueuedAt := c.tracker.waiting[queueLagTestKey].Value.(time.Time)
						if i == 0 && tt.reenqueue {
							assert.Equal(t, pendingAt, enqueuedAt, "retry must preserve the pending informer's enqueue time")
						} else {
							assert.False(t, enqueuedAt.Before(completedAt), "retry must be timed from its own enqueue")
							assert.LessOrEqual(t, c.gauge(), time.Since(completedAt).Seconds())
						}
						c.clock.Step(time.Second)
					}
				}
				assert.Equal(t, len(tt.results), attempt)
				assert.Empty(t, c.tracker.waiting)
				assert.Zero(t, c.gauge())
			})
		}
	}
}

func TestControllerQueueLagSuccessfulRedeliveryKeepsEnqueueTime(t *testing.T) {
	for _, component := range []string{"repository", "connection"} {
		for _, delivery := range []string{"informer update", "delayed reschedule"} {
			t.Run(component+"/"+delivery, func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					var c *queueLagControllerTest
					attempt := 0
					c = newQueueLagControllerTest(t, component, func() error {
						attempt++
						if attempt == 1 {
							c.advance(10 * time.Second)
							if delivery == "informer update" {
								go c.enqueue()
							} else {
								c.tracker.add(queueLagTestKey)
								c.queue.AddAfter(queueLagTestKey, 20*time.Second)
							}
							synctest.Wait()
							c.advance(20 * time.Second)
							c.advance(40 * time.Second)
							if delivery == "informer update" {
								c.enqueue()
							}
							c.advance(10 * time.Second)
							assert.Equal(t, 90.0, c.gauge(), "in-flight attempt still contributes its full age")
						} else {
							assert.Equal(t, 80.0, c.gauge(), "redelivery must be timed from its own enqueue at second 20")
						}
						return nil
					})
					c.enqueue()
					c.advance(10 * time.Second)
					require.True(t, c.processNext())
					assert.Equal(t, 70.0, c.gauge(), "pending delivery keeps the time it waited during processing")
					count, sum := c.waitSamples()
					assert.Equal(t, uint64(1), count)
					assert.Equal(t, 10.0, sum)
					c.advance(10 * time.Second)
					require.True(t, c.processNext())
					assert.Equal(t, 2, attempt)
					assert.Zero(t, c.gauge())
					count, sum = c.waitSamples()
					assert.Equal(t, uint64(2), count)
					wantSecondWait := 80.0
					if delivery == "delayed reschedule" {
						// The histogram still excludes backoff; the lag tracker includes it.
						wantSecondWait = 60.0
					}
					assert.Equal(t, wantSecondWait, sum-10)
				})
			})
		}
	}
}

func TestControllerQueueLagRepeatedRedelivery(t *testing.T) {
	dialTimeout := &url.Error{Op: "Get", URL: "https://gitlab.example/api/v4/projects/test", Err: &net.OpError{
		Op: "dial", Net: "tcp", Err: context.DeadlineExceeded,
	}}
	for _, component := range []string{"repository", "connection"} {
		attemptLimit := maxAttempts
		if component == "connection" {
			attemptLimit = connectionMaxAttempts
		}
		for _, tt := range []struct {
			name     string
			err      error
			attempts int
		}{
			{name: "success"},
			{name: "terminal failure", err: errors.New("invalid configuration")},
			{name: "dial timeout", err: dialTimeout},
			{name: "exhausted retries", err: apierrors.NewServiceUnavailable("unavailable"), attempts: attemptLimit - 1},
		} {
			t.Run(component+"/"+tt.name, func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					var c *queueLagControllerTest
					attempt := 0
					c = newQueueLagControllerTest(t, component, func() error {
						attempt++
						wantAge := 75.0
						if attempt > 1 {
							wantAge = 80.0
						}
						time.Sleep(time.Minute)
						go c.enqueue()
						synctest.Wait()
						time.Sleep(5 * time.Second)
						assert.Equal(t, wantAge, c.gauge(), "active attempt still contributes its age")
						return tt.err
					})
					for range 3 {
						c.enqueue()
						// Seed the retry count without scheduling extra deliveries.
						for range tt.attempts {
							c.limiter.When(queueLagTestKey)
						}
						time.Sleep(10 * time.Second)
						require.True(t, c.processNext())
						assert.Equal(t, 5.0, c.gauge(), "only the pending update's own wait remains")
						assert.Empty(t, c.tracker.inflight)
						require.Contains(t, c.tracker.waiting, queueLagTestKey)
						assert.Equal(t, 1, c.queue.Len(), "only the informer delivery remains")
						assert.Zero(t, c.queue.NumRequeues(queueLagTestKey), "completion must not add another retry")
					}
				})
			})
		}
	}
}

func assertRepositoryStatusFailurePreservesPendingQueueLag(t *testing.T, rc *RepositoryController, key string) {
	t.Helper()
	rc.queue = workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[string]())
	t.Cleanup(rc.queue.ShutDown)
	var pendingAt time.Time
	rc.processFn = func(key string) (string, error) {
		rc.queueLag.add(key)
		rc.queue.Add(key)
		pendingAt = rc.queueLag.waiting[key].Value.(time.Time)
		repoType, err := rc.process(key)
		require.NoError(t, err, "status-reported failure must not become a controller retry")
		return repoType, err
	}
	rc.queueLag.add(key)
	rc.queue.Add(key)
	require.True(t, rc.processNextWorkItem(t.Context()))
	assert.Empty(t, rc.queueLag.inflight)
	require.Contains(t, rc.queueLag.waiting, key)
	assert.Equal(t, pendingAt, rc.queueLag.waiting[key].Value.(time.Time), "pending update must keep its own enqueue time")
	assert.Equal(t, 1, rc.queue.Len(), "only the pending update should remain")
	assert.Zero(t, rc.queue.NumRequeues(key))
}

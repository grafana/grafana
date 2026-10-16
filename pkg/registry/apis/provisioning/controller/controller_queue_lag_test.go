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

func newQueueLagControllerTest(t *testing.T, component string, limiter workqueue.TypedRateLimiter[string], process func() error) *queueLagControllerTest {
	t.Helper()
	reg := prometheus.NewPedanticRegistry()
	queueReg := prometheus.NewPedanticRegistry()
	clock := testingclock.NewFakeClock(time.Now())
	if limiter == nil {
		limiter = workqueue.DefaultTypedControllerRateLimiter[string]()
	}
	queueConfig := workqueue.TypedQueueConfig[string]{
		Name:            "queue-lag-test",
		Clock:           clock,
		MetricsProvider: newWorkerQueueWaitProvider(queueReg, component),
	}
	c := &queueLagControllerTest{
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
		rc.queue = newWorkerQueue(&rc.queueLag, limiter, queueConfig)
		c.queue = rc.queue
		rc.processFn = func(string) (string, error) { return "", process() }
		c.tracker = &rc.queueLag
		repo := &provisioning.Repository{ObjectMeta: meta}
		c.enqueue = func() { rc.EventHandler().UpdateFunc(repo, repo) }
		c.processNext = func() bool { return rc.processNextWorkItem(t.Context()) }
	case "connection":
		cc := NewConnectionController(nil, nil, nil, nil, time.Minute, 5*time.Second, reg, nil, false)
		cc.queue.ShutDown()
		cc.queue = newWorkerQueue(&cc.queueLag, limiter, queueConfig)
		c.queue = cc.queue
		cc.processFn = func(_ context.Context, _ string) error { return process() }
		c.tracker = &cc.queueLag
		conn := &provisioning.Connection{ObjectMeta: meta}
		c.enqueue = func() { cc.EventHandler().UpdateFunc(conn, conn) }
		c.processNext = func() bool { return cc.processNextWorkItem(t.Context()) }
	default:
		t.Fatalf("unknown controller %q", component)
	}
	t.Cleanup(c.queue.ShutDown)
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
				c = newQueueLagControllerTest(t, component, nil, func() error {
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
						if i == 0 && tt.reenqueue {
							require.Contains(t, c.tracker.waiting, queueLagTestKey)
							enqueuedAt := c.tracker.waiting[queueLagTestKey].Value.(time.Time)
							assert.Equal(t, pendingAt, enqueuedAt, "retry must preserve the pending informer's enqueue time")
						} else {
							assert.Empty(t, c.tracker.waiting, "scheduled retry must not count as queued work")
							assert.Zero(t, c.gauge())
							c.clock.Step(time.Second)
							require.Eventually(t, func() bool { return c.queue.Len() > 0 }, time.Second, time.Millisecond)
							require.Contains(t, c.tracker.waiting, queueLagTestKey)
							enqueuedAt := c.tracker.waiting[queueLagTestKey].Value.(time.Time)
							assert.False(t, enqueuedAt.Before(completedAt), "retry must be timed from its own enqueue")
							assert.LessOrEqual(t, c.gauge(), time.Since(completedAt).Seconds())
						}
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
					wantSecondWait := 80.0
					if delivery == "delayed reschedule" {
						wantSecondWait = 60.0
					}
					c = newQueueLagControllerTest(t, component, nil, func() error {
						attempt++
						if attempt == 1 {
							c.advance(10 * time.Second)
							if delivery == "informer update" {
								go c.enqueue()
							} else {
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
							assert.Equal(t, wantSecondWait, c.gauge(), "redelivery must be timed from its actual enqueue")
						}
						return nil
					})
					c.enqueue()
					c.advance(10 * time.Second)
					require.True(t, c.processNext())
					assert.Equal(t, wantSecondWait-10, c.gauge(), "pending delivery keeps the time it waited during processing")
					count, sum := c.waitSamples()
					assert.Equal(t, uint64(1), count)
					assert.Equal(t, 10.0, sum)
					c.advance(10 * time.Second)
					require.True(t, c.processNext())
					assert.Equal(t, 2, attempt)
					assert.Zero(t, c.gauge())
					count, sum = c.waitSamples()
					assert.Equal(t, uint64(2), count)
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
					c = newQueueLagControllerTest(t, component, nil, func() error {
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

func TestControllerQueueLagDelayedRetries(t *testing.T) {
	const delay = 2 * time.Minute
	for _, component := range []string{"repository", "connection"} {
		for _, method := range []string{"AddAfter", "AddRateLimited"} {
			t.Run(component+"/"+method, func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					var c *queueLagControllerTest
					limiter := workqueue.NewTypedItemExponentialFailureRateLimiter[string](delay, delay)
					c = newQueueLagControllerTest(t, component, limiter, func() error {
						assert.Equal(t, 10.0, c.gauge(), "only time since actual enqueue contributes at pickup")
						c.advance(5 * time.Second)
						assert.Equal(t, 15.0, c.gauge(), "processing time still contributes")
						return nil
					})
					schedule := func() {
						if method == "AddAfter" {
							c.queue.AddAfter(queueLagTestKey, delay)
						} else {
							c.queue.AddRateLimited(queueLagTestKey)
						}
					}
					schedule()
					synctest.Wait()
					c.advance(30 * time.Second)
					schedule()
					synctest.Wait()
					c.advance(delay - 30*time.Second - time.Nanosecond)
					assert.Zero(t, c.gauge(), "intentional delay must not appear as queue lag")
					assert.Empty(t, c.tracker.waiting)
					assert.Empty(t, c.tracker.inflight)
					require.Zero(t, c.queue.Len())
					count, _ := c.waitSamples()
					assert.Zero(t, count)

					c.advance(time.Nanosecond)
					require.Equal(t, 1, c.queue.Len(), "duplicate scheduling must preserve the earliest deadline")
					assert.Zero(t, c.gauge())
					c.advance(10 * time.Second)
					require.True(t, c.processNext())
					assert.Zero(t, c.gauge())
					count, sum := c.waitSamples()
					assert.Equal(t, uint64(1), count)
					assert.Equal(t, 10.0, sum, "histogram and lag both exclude the delay")
					assert.Zero(t, c.queue.NumRequeues(queueLagTestKey))
					c.advance(delay)
					assert.Zero(t, c.queue.Len(), "coalesced scheduling must not produce another delivery")
					assert.Zero(t, c.gauge())
				})
			})
		}
	}
}

func TestControllerQueueLagInformerDuringBackoff(t *testing.T) {
	const delay = 30 * time.Second
	for _, component := range []string{"repository", "connection"} {
		for _, state := range []string{"still waiting", "already processed"} {
			t.Run(component+"/"+state, func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					limiter := workqueue.NewTypedItemExponentialFailureRateLimiter[string](delay, delay)
					c := newQueueLagControllerTest(t, component, limiter, func() error { return nil })
					c.queue.AddRateLimited(queueLagTestKey)
					synctest.Wait()
					c.advance(10 * time.Second)
					assert.Zero(t, c.gauge())
					c.enqueue()
					c.advance(5 * time.Second)
					assert.Equal(t, 5.0, c.gauge())
					if state == "already processed" {
						require.True(t, c.processNext())
						assert.Zero(t, c.gauge())
					}
					c.advance(15 * time.Second)
					require.Equal(t, 1, c.queue.Len())
					if state == "still waiting" {
						assert.Equal(t, 20.0, c.gauge(), "retry must retain the earlier informer enqueue time")
					} else {
						assert.Zero(t, c.gauge(), "delayed retry starts a new entry after the informer pass completed")
					}
					c.advance(10 * time.Second)
					require.True(t, c.processNext())
					assert.Zero(t, c.gauge())
					count, sum := c.waitSamples()
					if state == "still waiting" {
						assert.Equal(t, uint64(1), count)
						assert.Equal(t, 30.0, sum)
					} else {
						assert.Equal(t, uint64(2), count)
						assert.Equal(t, 15.0, sum)
					}
				})
			})
		}
	}
}

func TestControllerQueueLagShutdownDuringBackoff(t *testing.T) {
	for _, component := range []string{"repository", "connection"} {
		t.Run(component, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				c := newQueueLagControllerTest(t, component, nil, func() error {
					t.Fatal("a cancelled delayed retry must not be processed")
					return nil
				})
				c.queue.AddAfter(queueLagTestKey, time.Minute)
				synctest.Wait()
				c.advance(30 * time.Second)
				c.queue.ShutDown()
				c.advance(time.Minute)
				c.enqueue()
				c.advance(time.Second)
				assert.Zero(t, c.queue.Len())
				assert.Zero(t, c.gauge(), "discarded enqueues must not leave phantom lag")
				assert.Empty(t, c.tracker.waiting)
				assert.Empty(t, c.tracker.inflight)
				assert.False(t, c.processNext())
			})
		})
	}
}

func assertRepositoryStatusFailurePreservesPendingQueueLag(t *testing.T, rc *RepositoryController, key string) {
	t.Helper()
	rc.queue = newWorkerQueue(&rc.queueLag, workqueue.DefaultTypedControllerRateLimiter[string](), workqueue.TypedQueueConfig[string]{})
	t.Cleanup(rc.queue.ShutDown)
	var pendingAt time.Time
	rc.processFn = func(key string) (string, error) {
		rc.queue.Add(key)
		pendingAt = rc.queueLag.waiting[key].Value.(time.Time)
		repoType, err := rc.process(key)
		require.NoError(t, err, "status-reported failure must not become a controller retry")
		return repoType, err
	}
	rc.queue.Add(key)
	require.True(t, rc.processNextWorkItem(t.Context()))
	assert.Empty(t, rc.queueLag.inflight)
	require.Contains(t, rc.queueLag.waiting, key)
	assert.Equal(t, pendingAt, rc.queueLag.waiting[key].Value.(time.Time), "pending update must keep its own enqueue time")
	assert.Equal(t, 1, rc.queue.Len(), "only the pending update should remain")
	assert.Zero(t, rc.queue.NumRequeues(key))
}

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
}

func newQueueLagControllerTest(t *testing.T, component string, process func() error) *queueLagControllerTest {
	t.Helper()
	reg := prometheus.NewPedanticRegistry()
	clock := testingclock.NewFakeClock(time.Now())
	limiter := workqueue.DefaultTypedControllerRateLimiter[string]()
	queue := workqueue.NewTypedRateLimitingQueueWithConfig(
		limiter,
		workqueue.TypedRateLimitingQueueConfig[string]{Clock: clock},
	)
	t.Cleanup(queue.ShutDown)
	c := &queueLagControllerTest{
		queue:   queue,
		limiter: limiter,
		clock:   clock,
		gauge: func() float64 {
			return gaugeValueByName(t, reg, "grafana_provisioning_"+component+"_worker_queue_lag_seconds")
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
						enqueuedAt := c.tracker.waiting[queueLagTestKey]
						assert.False(t, enqueuedAt.Before(completedAt), "retry must be timed from its own enqueue")
						assert.LessOrEqual(t, c.gauge(), time.Since(completedAt).Seconds())
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

func TestControllerQueueLagSuccessfulRedeliveryPreservesAge(t *testing.T) {
	for _, component := range []string{"repository", "connection"} {
		for _, delivery := range []string{"informer update", "delayed reschedule"} {
			t.Run(component+"/"+delivery, func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					var c *queueLagControllerTest
					attempt := 0
					c = newQueueLagControllerTest(t, component, func() error {
						attempt++
						if attempt == 1 {
							time.Sleep(time.Minute)
							if delivery == "informer update" {
								go c.enqueue()
								synctest.Wait()
							} else {
								c.tracker.add(queueLagTestKey)
								c.queue.AddAfter(queueLagTestKey, 20*time.Second)
							}
							time.Sleep(5 * time.Second)
							assert.Equal(t, 75.0, c.gauge(), "in-flight attempt still contributes its full age")
							if delivery == "informer update" {
								c.enqueue()
							}
						} else {
							assert.Equal(t, 100.0, c.gauge(), "successful redelivery must retain its original enqueue time")
						}
						return nil
					})
					c.enqueue()
					time.Sleep(10 * time.Second)
					require.True(t, c.processNext())
					assert.Equal(t, 75.0, c.gauge())
					time.Sleep(25 * time.Second)
					c.clock.Step(30 * time.Second)
					require.True(t, c.processNext())
					assert.Equal(t, 2, attempt)
					assert.Zero(t, c.gauge())
				})
			})
		}
	}
}

func TestControllerQueueLagFailedRedelivery(t *testing.T) {
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
			{name: "terminal failure", err: errors.New("invalid configuration")},
			{name: "dial timeout", err: dialTimeout},
			{name: "exhausted retries", err: apierrors.NewServiceUnavailable("unavailable"), attempts: attemptLimit - 1},
		} {
			t.Run(component+"/"+tt.name, func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					var c *queueLagControllerTest
					c = newQueueLagControllerTest(t, component, func() error {
						time.Sleep(time.Minute)
						go c.enqueue()
						synctest.Wait()
						time.Sleep(5 * time.Second)
						assert.Equal(t, 75.0, c.gauge(), "active attempt still contributes its age")
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
						assert.Zero(t, c.gauge(), "failed attempt must not age the pending update")
						assert.Empty(t, c.tracker.inflight)
						require.Contains(t, c.tracker.waiting, queueLagTestKey)
						assert.Equal(t, 1, c.queue.Len(), "only the informer delivery remains")
						assert.Zero(t, c.queue.NumRequeues(queueLagTestKey), "failure must not add another retry")
					}
				})
			})
		}
	}
}

func assertRepositoryStatusFailureResetsQueueLag(t *testing.T, rc *RepositoryController, key string) {
	t.Helper()
	rc.queue = workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[string]())
	t.Cleanup(rc.queue.ShutDown)
	var startedAt time.Time
	rc.processFn = func(key string) (string, error) {
		rc.queueLag.add(key)
		rc.queue.Add(key)
		startedAt = time.Now()
		repoType, err := rc.process(key)
		require.NoError(t, err, "status-reported failure must not become a controller retry")
		return repoType, err
	}
	rc.queueLag.add(key)
	rc.queue.Add(key)
	require.True(t, rc.processNextWorkItem(t.Context()))
	assert.Empty(t, rc.queueLag.inflight)
	require.Contains(t, rc.queueLag.waiting, key)
	assert.False(t, rc.queueLag.waiting[key].Before(startedAt), "pending update must not inherit failed attempt's age")
	assert.Equal(t, 1, rc.queue.Len(), "only the pending update should remain")
	assert.Zero(t, rc.queue.NumRequeues(key))
}

package controller

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/workqueue"
	testingclock "k8s.io/utils/clock/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

func newConnectionControllerForQueueTest(t *testing.T) (*ConnectionController, *prometheus.Registry) {
	t.Helper()
	reg := prometheus.NewPedanticRegistry()
	cc := NewConnectionController(nil, nil, nil, nil, time.Minute, 5*time.Second, reg, nil, false)
	t.Cleanup(cc.queue.ShutDown)
	return cc, reg
}

// Advance only the queue clock: Kubernetes' global error backoff keeps a wall
// clock timestamp that cannot be used inside a synctest bubble.
func useFakeConnectionQueueClock(t *testing.T, cc *ConnectionController) *testingclock.FakeClock {
	t.Helper()
	cc.queue.ShutDown()
	clock := testingclock.NewFakeClock(time.Now())
	cc.queue = workqueue.NewTypedRateLimitingQueueWithConfig(
		workqueue.DefaultTypedControllerRateLimiter[string](),
		workqueue.TypedRateLimitingQueueConfig[string]{Clock: clock},
	)
	t.Cleanup(cc.queue.ShutDown)
	return clock
}

func TestConnectionController_DeduplicatesEnqueueBeforeProcessing(t *testing.T) {
	cc, _ := newConnectionControllerForQueueTest(t)
	var processedKeys []string
	cc.processFn = func(_ context.Context, key string) error {
		processedKeys = append(processedKeys, key)
		return nil
	}

	conns := []*provisioning.Connection{
		{ObjectMeta: metav1.ObjectMeta{Namespace: "ns-a", Name: "conn-a"}},
		{ObjectMeta: metav1.ObjectMeta{Namespace: "ns-a", Name: "conn-b"}},
		{ObjectMeta: metav1.ObjectMeta{Namespace: "ns-b", Name: "conn-a"}},
	}
	handler := cc.EventHandler()
	for _, conn := range conns {
		handler.AddFunc(conn, true)
		for range 5 {
			handler.UpdateFunc(conn, conn.DeepCopy())
		}
	}

	require.Equal(t, len(conns), cc.queue.Len())
	for range conns {
		require.Positive(t, cc.queue.Len())
		require.True(t, cc.processNextWorkItem(t.Context()))
	}
	assert.ElementsMatch(t, []string{"ns-a/conn-a", "ns-a/conn-b", "ns-b/conn-a"}, processedKeys)
	assert.Zero(t, cc.queue.Len())
	assert.Empty(t, cc.triggers)
}

func TestConnectionController_DeduplicatesEnqueueWhileProcessing(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cc, _ := newConnectionControllerForQueueTest(t)
		ctx, cancel := context.WithCancel(t.Context())
		t.Cleanup(cancel)
		release := make(chan struct{})
		releaseFirst := sync.OnceFunc(func() { close(release) })
		t.Cleanup(releaseFirst)
		var processCount, otherProcessCount atomic.Int32
		cc.processFn = func(_ context.Context, key string) error {
			switch key {
			case "ns-a/conn":
				if processCount.Add(1) == 1 {
					<-release
				}
			case "ns-b/conn":
				otherProcessCount.Add(1)
			default:
				t.Errorf("unexpected connection key %q", key)
			}
			return nil
		}

		conn := &provisioning.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: "ns-a", Name: "conn"}}
		handler := cc.EventHandler()
		handler.AddFunc(conn, true)
		runDone := make(chan struct{})
		go func() {
			cc.Run(ctx, 2, func() {}, func() {})
			close(runDone)
		}()
		synctest.Wait()
		require.Equal(t, int32(1), processCount.Load())

		for range 5 {
			handler.UpdateFunc(conn, conn.DeepCopy())
		}
		handler.AddFunc(&provisioning.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: "ns-b", Name: "conn"}}, false)
		synctest.Wait()
		assert.Equal(t, int32(1), processCount.Load(), "the in-flight key must not be processed by another worker")
		assert.Equal(t, int32(1), otherProcessCount.Load(), "another connection can be processed concurrently")

		releaseFirst()
		synctest.Wait()
		cancel()
		<-runDone
		assert.Equal(t, int32(2), processCount.Load(), "updates must coalesce into one additional reconciliation")
		assert.Equal(t, int32(1), otherProcessCount.Load())
		assert.Zero(t, cc.queue.Len())
		assert.Empty(t, cc.triggers)
	})
}

func TestConnectionController_RetriesAndClearsState(t *testing.T) {
	unavailable := apierrors.NewServiceUnavailable("temporarily unavailable")
	terminal := errors.New("invalid connection")
	for _, tt := range []struct {
		name     string
		results  []error
		internal bool
	}{
		{name: "service unavailable exhausts attempts", results: []error{unavailable, unavailable, unavailable}},
		{name: "non-retryable error", results: []error{terminal}},
		{name: "retry succeeds", results: []error{unavailable, nil}},
		{name: "retry fails permanently", results: []error{unavailable, terminal}},
		{name: "internal retry has no attribution", results: []error{unavailable, nil}, internal: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cc, reg := newConnectionControllerForQueueTest(t)
			clock := useFakeConnectionQueueClock(t, cc)
			const key = "ns/conn"
			conn := &provisioning.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "conn", ResourceVersion: "5"}}
			processCount := 0
			cc.processFn = func(_ context.Context, gotKey string) error {
				require.Equal(t, key, gotKey)
				require.Less(t, processCount, len(tt.results), "unexpected retry")
				assert.Equal(t, processCount, cc.queue.NumRequeues(key))
				err := tt.results[processCount]
				processCount++
				return err
			}
			wantTrigger := "initial"
			if tt.internal {
				cc.queue.Add(key)
				wantTrigger = ""
			} else {
				cc.EventHandler().AddFunc(conn, true)
			}

			for i := range tt.results {
				require.True(t, cc.processNextWorkItem(t.Context()))
				if i < len(tt.results)-1 {
					assert.Equal(t, i+1, cc.queue.NumRequeues(key))
					if tt.internal {
						assert.Empty(t, cc.triggers)
					} else {
						assert.Equal(t, wantTrigger, string(cc.triggers[key]))
					}
					clock.Step(time.Second)
				}
			}
			assert.Equal(t, len(tt.results), processCount)
			assert.Zero(t, cc.queue.NumRequeues(key))
			assert.Empty(t, cc.triggers)
			assertOnlyProcessedTrigger(t, reg, "connections", wantTrigger)
			assert.Zero(t, cc.queue.Len())

			cc.processFn = func(_ context.Context, gotKey string) error {
				assert.Equal(t, key, gotKey)
				assert.Zero(t, cc.queue.NumRequeues(key), "a new event starts with a fresh retry budget")
				return nil
			}
			cc.EventHandler().AddFunc(conn, false)
			require.True(t, cc.processNextWorkItem(t.Context()))
			assert.Equal(t, 1.0, processedCounterValue(t, reg, "connections", "live"))
			assert.Zero(t, cc.queue.NumRequeues(key))
			assert.Zero(t, cc.queue.Len())
			assert.Empty(t, cc.triggers)
		})
	}
}

func TestConnectionController_DirtyRedeliveryKeepsTrigger(t *testing.T) {
	for _, tt := range []struct {
		name       string
		firstError error
	}{
		{name: "success"},
		{name: "terminal error", firstError: errors.New("invalid connection")},
		{name: "retryable error", firstError: apierrors.NewServiceUnavailable("temporarily unavailable")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cc, reg := newConnectionControllerForQueueTest(t)
			clock := useFakeConnectionQueueClock(t, cc)
			conn := &provisioning.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "conn", ResourceVersion: "5"}}
			updated := conn.DeepCopy()
			updated.ResourceVersion = "6"
			processCount := 0
			cc.processFn = func(context.Context, string) error {
				processCount++
				if processCount == 1 {
					cc.EventHandler().UpdateFunc(conn, updated)
					return tt.firstError
				}
				return nil
			}

			cc.EventHandler().AddFunc(conn, true)
			require.True(t, cc.processNextWorkItem(t.Context()))
			require.Equal(t, 1, cc.queue.Len())
			assert.Equal(t, "live", string(cc.triggers["ns/conn"]), "completion and retry must preserve the newer event")
			require.True(t, cc.processNextWorkItem(t.Context()))

			if apierrors.IsServiceUnavailable(tt.firstError) {
				clock.Step(time.Second)
				// The dirty delivery consumes the retry budget. The delayed retry
				// still arrives, but has no informer event to count after success.
				require.True(t, cc.processNextWorkItem(t.Context()))
				assert.Equal(t, 3, processCount)
				assertOnlyProcessedTrigger(t, reg, "connections", "initial")
			} else {
				assert.Equal(t, 2, processCount)
				assert.Equal(t, 1.0, processedCounterValue(t, reg, "connections", "initial"))
				assert.Equal(t, 1.0, processedCounterValue(t, reg, "connections", "live"))
				assert.Zero(t, processedCounterValue(t, reg, "connections", "relist"))
			}
			assert.Zero(t, cc.queue.NumRequeues("ns/conn"))
			assert.Zero(t, cc.queue.Len())
			assert.Empty(t, cc.triggers)
		})
	}
}

func TestConnectionController_RecentlyWrittenTokenReschedulesKey(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cc, reg := newConnectionControllerForQueueTest(t)
		conn := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "conn", ResourceVersion: "5"},
			Secure:     provisioning.ConnectionSecure{Token: common.InlineSecureValue{Name: "recent-token"}},
			Status:     provisioning.ConnectionStatus{Token: provisioning.TokenStatus{LastUpdated: time.Now().UnixMilli()}},
		}
		original := conn.DeepCopy()
		cc.conns = informer.NewCachedConnectionGetter(&mockConnectionLister{conn: conn})
		cc.tracer = tracing.NewNoopTracerService()
		healthChecker := NewMockConnectionHealthChecker(t)
		healthChecker.EXPECT().ShouldCheckHealth(conn).Return(false).Twice()
		cc.healthChecker = healthChecker
		factory := connection.NewMockFactory(t)
		factory.EXPECT().Build(mock.Anything, conn).
			Return(nil, fmt.Errorf("unable to decrypt token: %w", connection.ErrTokenNotFound)).Once()
		factory.EXPECT().Build(mock.Anything, conn).Return(connection.NewMockConnection(t), nil).Once()
		cc.connectionFactory = factory

		cc.EventHandler().AddFunc(conn, true)
		require.True(t, cc.processNextWorkItem(t.Context()))
		synctest.Wait()
		require.Zero(t, cc.queue.Len())

		time.Sleep(tokenWriteRetryDelay - time.Nanosecond)
		synctest.Wait()
		require.Zero(t, cc.queue.Len(), "token retry must wait for the configured delay")
		time.Sleep(time.Nanosecond)
		synctest.Wait()
		require.Equal(t, 1, cc.queue.Len())
		require.True(t, cc.processNextWorkItem(t.Context()))
		assert.Zero(t, cc.queue.Len())
		assert.Zero(t, cc.queue.NumRequeues("ns/conn"))
		assert.Empty(t, cc.triggers)
		assertOnlyProcessedTrigger(t, reg, "connections", "initial")
		assert.Equal(t, original, conn, "the recent token must not be cleared or regenerated")
	})
}

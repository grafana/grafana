package features

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
)

func TestParseWatchRequest(t *testing.T) {
	userid := "userid" // dummy
	tests := []struct {
		testCase string
		channel  string
		userid   string // override

		// Expect
		gvr  schema.GroupVersionResource
		name string
		err  bool
	}{
		{
			testCase: "dashbaords",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards/userid",
			gvr: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
		},
		{
			testCase: "dashbaords with anme",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards=abc/userid",
			gvr: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			name: "abc",
		},
		{
			testCase: "bad user id",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards/x",
			err:      true, // bad user id
		},
	}
	for _, tt := range tests {
		t.Run(tt.testCase, func(t *testing.T) {
			gvr, name, err := parseWatchRequest(tt.channel, first(tt.userid, userid))
			if tt.err {
				require.Error(t, err)
				return
			}
			require.Equal(t, tt.gvr, gvr)
			require.Equal(t, tt.name, name)
		})
	}
}

func first(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// A closed watch stream is routine: the apiserver and the storage backend both
// end watches on their own schedule, and nothing tells subscribers when it
// happens. These cover the resume path that keeps the channel alive. They run
// under synctest so the resume backoff is virtual: no real sleeping, and the
// timing assertions are exact rather than best-effort.

func testObject(rv string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Job",
		"metadata": map[string]interface{}{
			"name":            "job",
			"resourceVersion": rv,
		},
	}}
}

// testWatcher wires a watcher to a sequence of fake streams: the first is used
// directly, the rest handed out by successive newWatch calls, which also record
// every resourceVersion they were asked to resume from.
// synctest.Wait settles the goroutine but is not a synchronisation edge, so the
// recorded state is guarded: the watcher writes it, the test reads it.
type testWatcher struct {
	*watcher
	stopped chan struct{}

	mu          sync.Mutex
	resumedFrom []string
	published   []string
}

func (tw *testWatcher) resumes() []string {
	tw.mu.Lock()
	defer tw.mu.Unlock()
	return slices.Clone(tw.resumedFrom)
}

func (tw *testWatcher) publishedVersions() []string {
	tw.mu.Lock()
	defer tw.mu.Unlock()
	return slices.Clone(tw.published)
}

func (tw *testWatcher) recordResume(resourceVersion string) {
	tw.mu.Lock()
	defer tw.mu.Unlock()
	tw.resumedFrom = append(tw.resumedFrom, resourceVersion)
}

func newTestWatcher(t *testing.T, streams ...*watch.FakeWatcher) *testWatcher {
	t.Helper()
	require.NotEmpty(t, streams)

	tw := &testWatcher{stopped: make(chan struct{})}
	next := 1
	tw.watcher = &watcher{
		ns:      "default",
		channel: "watch/provisioning.grafana.app/v0alpha1/jobs/user",
		watch:   streams[0],
		publisher: func(_ string, _ string, data []byte) error {
			var evt struct {
				Object struct {
					Metadata struct {
						ResourceVersion string `json:"resourceVersion"`
					} `json:"metadata"`
				} `json:"object"`
			}
			require.NoError(t, json.Unmarshal(data, &evt))
			tw.mu.Lock()
			defer tw.mu.Unlock()
			tw.published = append(tw.published, evt.Object.Metadata.ResourceVersion)
			return nil
		},
		newWatch: func(_ context.Context, resourceVersion string) (watch.Interface, error) {
			tw.recordResume(resourceVersion)
			if next >= len(streams) {
				return nil, fmt.Errorf("no more streams")
			}
			s := streams[next]
			next++
			return s, nil
		},
	}
	return tw
}

// start runs the watcher in the bubble. Callers use synctest.Wait to settle it,
// so no field is read while the goroutine is still runnable.
func (tw *testWatcher) start(ctx context.Context) {
	go func() {
		defer close(tw.stopped)
		tw.run(ctx)
	}()
}

// settleBackoff advances virtual time past one whole backoff step and settles
// the watcher. dskit jitters within the exponential range, so a test cannot
// name the exact delay; sleeping the ceiling covers any draw. Only the backoff
// test itself cares where inside the range a given wait landed.
func settleBackoff() {
	synctest.Wait()
	time.Sleep(resumeBackoffMax)
	synctest.Wait()
}

func TestWatcherResumesAfterStreamCloses(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		first, second := watch.NewFake(), watch.NewFake()
		tw := newTestWatcher(t, first, second)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		tw.start(ctx)

		first.Add(testObject("1"))
		synctest.Wait()
		require.Equal(t, []string{"1"}, tw.publishedVersions())

		first.Stop() // closes ResultChan, as a real ended watch does
		settleBackoff()
		require.Equal(t, []string{"1"}, tw.resumes(),
			"resume must start at the last published resourceVersion")

		// The channel must keep delivering instead of going silent.
		second.Add(testObject("2"))
		synctest.Wait()
		require.Equal(t, []string{"1", "2"}, tw.publishedVersions(),
			"no event after the stream closed: the channel went silent")

		cancel()
		<-tw.stopped
		require.True(t, tw.done.Load())
	})
}

func TestWatcherRestartsFromNowWhenResourceVersionExpired(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		first, second := watch.NewFake(), watch.NewFake()
		tw := newTestWatcher(t, first, second)

		// Mimic a store that rejects a version aged out of its history window.
		handOut := tw.newWatch
		tw.newWatch = func(ctx context.Context, resourceVersion string) (watch.Interface, error) {
			if resourceVersion != "" {
				tw.recordResume(resourceVersion)
				return nil, apierrors.NewResourceExpired("too old resource version")
			}
			return handOut(ctx, resourceVersion)
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		tw.start(ctx)

		first.Add(testObject("7"))
		synctest.Wait()
		first.Stop()
		settleBackoff()

		require.Equal(t, []string{"7", ""}, tw.resumes(),
			"should retry from the last version, then fall back to watching from now")

		second.Add(testObject("8"))
		synctest.Wait()
		require.Equal(t, []string{"7", "8"}, tw.publishedVersions(),
			"an expired resourceVersion must not kill the watch")

		cancel()
		<-tw.stopped
	})
}

func TestWatcherBacksOffBetweenResumes(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		// Every stream closes immediately with nothing published, which is the
		// case that could otherwise spin the loop.
		const breaks = 8
		streams := make([]*watch.FakeWatcher, breaks+1)
		for i := range streams {
			streams[i] = watch.NewFake()
		}
		tw := newTestWatcher(t, streams...)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		tw.start(ctx)

		// dskit draws each wait from the exponential range rather than a fixed
		// value, so assert the bounds rather than an instant: nothing may
		// happen before the minimum, and everything must be free by the
		// maximum. Virtual time makes both edges exact.
		for i := range breaks {
			streams[i].Stop()
			synctest.Wait()
			require.Len(t, tw.resumes(), i, "must not resume before the backoff starts")

			time.Sleep(resumeBackoffMin - time.Nanosecond) // advances the bubble's clock
			synctest.Wait()
			require.Len(t, tw.resumes(), i, "must not resume before the minimum backoff")

			time.Sleep(resumeBackoffMax)
			synctest.Wait()
			require.Len(t, tw.resumes(), i+1,
				"resume %d must be released by the maximum backoff; an unclamped "+
					"backoff would still be asleep here", i+1)
		}

		cancel()
		<-tw.stopped
	})
}

// The watcher must not die because a reconnect attempt failed -- that would
// recreate the silently dead subscription it exists to prevent.
func TestWatcherKeepsRetryingWhenReopenFails(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		first, second := watch.NewFake(), watch.NewFake()
		tw := newTestWatcher(t, first, second)

		// The store is unreachable for the first few attempts, as during an
		// apiserver rollout, then recovers.
		handOut := tw.newWatch
		failures := 0
		tw.newWatch = func(ctx context.Context, resourceVersion string) (watch.Interface, error) {
			if failures < 3 {
				failures++
				tw.recordResume(resourceVersion)
				return nil, fmt.Errorf("connection refused")
			}
			return handOut(ctx, resourceVersion)
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		tw.start(ctx)

		first.Add(testObject("4"))
		synctest.Wait()
		first.Stop()

		for range 4 {
			settleBackoff()
		}

		require.Equal(t, []string{"4", "4", "4", "4"}, tw.resumes(),
			"a transient open failure must not discard the resume point")

		second.Add(testObject("5"))
		synctest.Wait()
		require.Equal(t, []string{"4", "5"}, tw.publishedVersions(),
			"the channel must recover once the store is reachable again")

		cancel()
		<-tw.stopped
	})
}

func TestWatcherStopsOnPublishFailure(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		first := watch.NewFake()
		tw := newTestWatcher(t, first)
		tw.publisher = func(_ string, _ string, _ []byte) error {
			return fmt.Errorf("publish boom")
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		tw.start(ctx)

		first.Add(testObject("1"))
		<-tw.stopped

		// Publishing is the watcher's whole job; resuming cannot fix it.
		require.Empty(t, tw.resumes(), "a publish failure should not trigger a resume")
		require.True(t, tw.done.Load())
	})
}

func TestWatcherStopsWhenContextIsCancelled(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		tw := newTestWatcher(t, watch.NewFake())

		ctx, cancel := context.WithCancel(context.Background())
		tw.start(ctx)
		cancel()
		<-tw.stopped

		require.Empty(t, tw.resumes(), "cancellation is not a broken stream")
		require.True(t, tw.done.Load())
	})
}

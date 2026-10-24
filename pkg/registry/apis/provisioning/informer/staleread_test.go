package informer

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8stesting "k8s.io/client-go/testing"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// staleReadsExhausted reads the exhausted-budget counter for a resource.
func staleReadsExhausted(t *testing.T, reg *prometheus.Registry, resourceName string) float64 {
	t.Helper()
	return counterValue(t, reg, "grafana_provisioning_stale_reads_exhausted_total",
		map[string]string{"resource": resourceName})
}

// fastStaleReads is the policy the tests run with: the same decisions, without
// the waiting.
func fastStaleReads(announced announcedVersions, rec FreshnessRecorder, attempts int) staleReadPolicy {
	p := newStaleReadPolicy(announced, rec)
	p.attempts = attempts
	p.backoff = 0
	return p
}

func TestReadFresh(t *testing.T) {
	const res = "repositories"
	ctx := context.Background()
	notFound := apierrors.NewNotFound(schema.GroupResource{Resource: res}, "r")

	t.Run("a read at or above the announced version is returned", func(t *testing.T) {
		want := repoAt(testNamespace, "r", rvString(rvAgo(0)))
		rec, reg := newFreshnessRecorder(t, res)
		reads := 0

		got, err := readFresh(ctx, fastStaleReads(&fixedAnnouncements{rv: rvAgo(time.Second)}, rec, 4), testNamespace, "r",
			func(context.Context, int64) (*provisioningapis.Repository, error) {
				reads++
				return want, nil
			})
		require.NoError(t, err)
		assert.Same(t, want, got)
		assert.Equal(t, 1, reads, "a current read must not be re-read")
		assert.Zero(t, staleReadsExhausted(t, reg, res))
	})

	t.Run("a read behind the announced version is re-read until it catches up", func(t *testing.T) {
		announced := rvAgo(0)
		rec, reg := newFreshnessRecorder(t, res)
		var reads atomic.Int32

		got, err := readFresh(ctx, fastStaleReads(&fixedAnnouncements{rv: announced}, rec, 4), testNamespace, "r",
			func(context.Context, int64) (*provisioningapis.Repository, error) {
				if reads.Add(1) < 3 {
					return repoAt(testNamespace, "r", rvString(rvAgo(5*time.Second))), nil
				}
				return repoAt(testNamespace, "r", rvString(announced)), nil
			})
		require.NoError(t, err)
		assert.Equal(t, rvString(announced), got.ResourceVersion)
		assert.EqualValues(t, 3, reads.Load())
		assert.Zero(t, staleReadsExhausted(t, reg, res), "catching up is not an exhausted budget")
	})

	t.Run("a read that never catches up surfaces ErrStaleRead", func(t *testing.T) {
		rec, reg := newFreshnessRecorder(t, res)
		var reads atomic.Int32

		got, err := readFresh(ctx, fastStaleReads(&fixedAnnouncements{rv: rvAgo(0)}, rec, 3), testNamespace, "r",
			func(context.Context, int64) (*provisioningapis.Repository, error) {
				reads.Add(1)
				return repoAt(testNamespace, "r", rvString(rvAgo(5*time.Second))), nil
			})
		require.ErrorIs(t, err, ErrStaleRead)
		assert.Nil(t, got, "superseded state must not reach the caller")
		assert.EqualValues(t, 3, reads.Load(), "the budget bounds the re-reads")
		assert.Equal(t, float64(1), staleReadsExhausted(t, reg, res))
	})

	// The second execution freshness.go excludes: an object deleted after its
	// announcement is correctly absent, and the DELETED proving it may have been
	// round-robined to another replica. A NotFound is therefore never evidence
	// of a lagging read, and must reach the controller as itself.
	t.Run("a NotFound is passed through, never re-read", func(t *testing.T) {
		rec, reg := newFreshnessRecorder(t, res)
		reads := 0

		_, err := readFresh(ctx, fastStaleReads(&fixedAnnouncements{rv: rvAgo(0)}, rec, 4), testNamespace, "r",
			func(context.Context, int64) (*provisioningapis.Repository, error) {
				reads++
				return nil, notFound
			})
		assert.Same(t, notFound, err)
		assert.False(t, errors.Is(err, ErrStaleRead))
		assert.Equal(t, 1, reads)
		assert.Zero(t, staleReadsExhausted(t, reg, res))
	})

	t.Run("other failures are passed through", func(t *testing.T) {
		boom := errors.New("boom")
		rec, _ := newFreshnessRecorder(t, res)

		_, err := readFresh(ctx, fastStaleReads(&fixedAnnouncements{rv: rvAgo(0)}, rec, 4), testNamespace, "r",
			func(context.Context, int64) (*provisioningapis.Repository, error) { return nil, boom })
		assert.Same(t, boom, err)
	})

	t.Run("nothing announced leaves the read alone", func(t *testing.T) {
		rec, _ := newFreshnessRecorder(t, res)
		want := repoAt(testNamespace, "r", rvString(rvAgo(time.Hour)))

		got, err := readFresh(ctx, fastStaleReads(&fixedAnnouncements{rv: 0}, rec, 4), testNamespace, "r",
			func(context.Context, int64) (*provisioningapis.Repository, error) { return want, nil })
		require.NoError(t, err)
		assert.Same(t, want, got)
	})

	t.Run("an unparseable version fails open", func(t *testing.T) {
		rec, _ := newFreshnessRecorder(t, res)
		want := repoAt(testNamespace, "r", "not-a-version")

		got, err := readFresh(ctx, fastStaleReads(&fixedAnnouncements{rv: rvAgo(0)}, rec, 4), testNamespace, "r",
			func(context.Context, int64) (*provisioningapis.Repository, error) { return want, nil })
		require.NoError(t, err)
		assert.Same(t, want, got)
	})

	// Same reason freshness.go samples before the read: a write committing while
	// a read is in flight may legally not be in its result. The announcement is
	// re-sampled per attempt, so a version announced during one attempt is the
	// bar for the next one, not for the attempt it landed in.
	t.Run("the announcement is sampled before every attempt", func(t *testing.T) {
		announced := &fixedAnnouncements{rv: 0}
		rec, _ := newFreshnessRecorder(t, res)
		stale := repoAt(testNamespace, "r", rvString(rvAgo(5*time.Second)))
		var reads atomic.Int32

		got, err := readFresh(ctx, fastStaleReads(announced, rec, 4), testNamespace, "r",
			func(context.Context, int64) (*provisioningapis.Repository, error) {
				if reads.Add(1) == 1 {
					// Announced while this read runs: it cannot indict it.
					announced.rv = rvAgo(0)
					return stale, nil
				}
				return repoAt(testNamespace, "r", rvString(announced.rv)), nil
			})
		require.NoError(t, err)
		assert.Same(t, stale, got, "the first read predates the announcement, so it stands")
		assert.EqualValues(t, 1, reads.Load())
		assert.Equal(t, 1, announced.calls, "sampled once, before the read")
	})

	t.Run("a cancelled context stops the re-reads", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		rec, _ := newFreshnessRecorder(t, res)
		p := newStaleReadPolicy(&fixedAnnouncements{rv: rvAgo(0)}, rec) // real backoff
		p.attempts = 4

		_, err := readFresh(ctx, p, testNamespace, "r", func(context.Context, int64) (*provisioningapis.Repository, error) {
			cancel()
			return repoAt(testNamespace, "r", rvString(rvAgo(5*time.Second))), nil
		})
		require.ErrorIs(t, err, context.Canceled)
	})
}

// The retry decorator wraps the observing one, so a re-read is measured on each
// attempt and the reconcile only ever sees a result at or above the announced
// version.
func TestRetryStaleRepositoryReads_WrapsTheObservedGetter(t *testing.T) {
	const res = "repositories"
	announced := rvAgo(0)
	rec, reg := newFreshnessRecorder(t, res)
	var reads atomic.Int32
	inner := stubRepositoryGetter{get: func(context.Context, string, string) (*provisioningapis.Repository, error) {
		if reads.Add(1) == 1 {
			return repoAt(testNamespace, "r", rvString(rvAgo(3*time.Second))), nil
		}
		return repoAt(testNamespace, "r", rvString(announced)), nil
	}}
	versions := &fixedAnnouncements{rv: announced}

	getter := retryStaleRepositoryReads(observeRepositoryFreshness(inner, versions, rec), rec)
	staleReadGetter, ok := getter.(staleReadRepositoryGetter)
	require.True(t, ok)
	staleReadGetter.policy.backoff = 0

	got, err := staleReadGetter.Get(context.Background(), testNamespace, "r")
	require.NoError(t, err)
	assert.Equal(t, rvString(announced), got.ResourceVersion)
	assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeBehind), "the first attempt is still measured")
	assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeCurrent), "and so is the one that caught up")
}

// End-to-end over the real informer: a notification holds the getter to the
// version it announced until the API serves it.
func TestNewRepositoryDeltaSource_RereadsBehindTheAnnouncedVersion(t *testing.T) {
	announced := rvAgo(0)
	var caughtUp atomic.Bool
	client := fake.NewClientset()
	client.PrependReactor("get", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
		if caughtUp.Load() {
			return true, repoAt(testNamespace, "r", rvString(announced)), nil
		}
		return true, repoAt(testNamespace, "r", rvString(rvAgo(5*time.Second))), nil
	})

	sub := newFakeSubscriber()
	source, getter := NewRepositoryDeltaSource(sub, client, nil, time.Minute, nil, NewFreshnessMetrics(nil))
	// The attempts matter, the waiting does not.
	staleReadGetter, ok := getter.(staleReadRepositoryGetter)
	require.True(t, ok, "the NATS getter must enforce read freshness")
	staleReadGetter.policy.backoff = 0

	_, err := source.AddEventHandler(&typeRecorder{})
	require.NoError(t, err)
	stopCh := make(chan struct{})
	go source.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	subject := resourcewatch.Subject(repoGVR, "")
	require.Eventually(t, func() bool { return sub.subscribed(subject) }, 5*time.Second, 10*time.Millisecond)

	// Before any notification there is nothing to hold the read to.
	_, err = staleReadGetter.Get(context.Background(), testNamespace, "r")
	require.NoError(t, err)

	// publish delivers synchronously, so the announcement is in place — exactly
	// the ordering the informer guarantees by recording it before dispatch.
	sub.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_MODIFIED, Namespace: testNamespace, Name: "r", ResourceVersion: announced,
	})

	_, err = staleReadGetter.Get(context.Background(), testNamespace, "r")
	require.ErrorIs(t, err, ErrStaleRead, "the API never serves the announced version")

	caughtUp.Store(true)
	got, err := staleReadGetter.Get(context.Background(), testNamespace, "r")
	require.NoError(t, err)
	assert.Equal(t, rvString(announced), got.ResourceVersion)
}

// The execution review reproduced against real storage: the object is deleted
// and that delete commits, but the DELETED is round-robined to another
// queue-group member, so this replica still has the announcement outstanding
// when it processes the queued key. The 404 its read returns is the truth — it
// must reach the controller as a NotFound, unread again and unconverted.
func TestNewRepositoryDeltaSource_UndeliveredDeleteKeepsTheNotFound(t *testing.T) {
	const res = "repositories"
	var reads atomic.Int32
	client := fake.NewClientset()
	client.PrependReactor("get", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
		reads.Add(1)
		return true, nil, apierrors.NewNotFound(schema.GroupResource{Resource: res}, "r")
	})

	reg := prometheus.NewRegistry()
	sub := newFakeSubscriber()
	source, getter := NewRepositoryDeltaSource(sub, client, nil, time.Minute, nil, NewFreshnessMetrics(reg))
	enforcing, ok := getter.(staleReadRepositoryGetter)
	require.True(t, ok)
	enforcing.policy.backoff = 0
	getter = enforcing

	stop := make(chan struct{})
	t.Cleanup(func() { close(stop) })
	go source.Run(stop)
	subject := resourcewatch.Subject(repoGVR, "")
	require.Eventually(t, func() bool { return sub.subscribed(subject) }, 5*time.Second, 10*time.Millisecond)

	// The create is announced here; the delete that follows it is not.
	sub.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_ADDED, Namespace: testNamespace, Name: "r", ResourceVersion: rvAgo(0),
	})

	_, err := getter.Get(context.Background(), testNamespace, "r")
	assert.True(t, apierrors.IsNotFound(err), "the delete committed; the latest read correctly 404s")
	assert.False(t, errors.Is(err, ErrStaleRead), "an outstanding announcement must not make a correct 404 stale")
	assert.EqualValues(t, 1, reads.Load(), "a NotFound must not be re-read")
	assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeNotFound), "counted as ambiguous, not behind")
	assert.Zero(t, freshnessCount(t, reg, res, outcomeBehind))
	assert.Zero(t, staleReadsExhausted(t, reg, res))
}

// advancingAnnouncements answers a newer version on every sample, as a stream of
// notifications would, and records what it handed out.
type advancingAnnouncements struct {
	mu      sync.Mutex
	next    int64
	samples []int64
}

func (a *advancingAnnouncements) Announced(string, string) int64 {
	a.mu.Lock()
	defer a.mu.Unlock()
	rv := a.next
	a.samples = append(a.samples, rv)
	// A newer write commits and is announced before the next sample.
	a.next = rv + 1000
	return rv
}

func (a *advancingAnnouncements) taken() []int64 {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]int64(nil), a.samples...)
}

// One read, one sample. Two samples taken around the same read can straddle an
// announcement, and the observation and the decision then disagree about it:
// recorded behind the newer sample while accepted against the older one, which
// lets the reconcile act on state the metric just called superseded.
func TestRetryStaleRepositoryReads_SamplesTheAnnouncementOncePerRead(t *testing.T) {
	const res = "repositories"
	versions := &advancingAnnouncements{next: rvAgo(time.Second)}
	rec, reg := newFreshnessRecorder(t, res)
	// Serves exactly the version the read's own sample announced.
	inner := stubRepositoryGetter{get: func(context.Context, string, string) (*provisioningapis.Repository, error) {
		return repoAt(testNamespace, "r", rvString(versions.taken()[0])), nil
	}}

	getter := retryStaleRepositoryReads(observeRepositoryFreshness(inner, versions, rec), rec)
	_, err := getter.Get(context.Background(), testNamespace, "r")
	require.NoError(t, err)

	assert.Len(t, versions.taken(), 1, "the read must be judged and recorded from a single sample")
	assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeCurrent))
	assert.Zero(t, freshnessCount(t, reg, res, outcomeBehind), "an accepted read must not be recorded behind")
}

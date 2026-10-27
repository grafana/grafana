package informer

import (
	"context"
	"strconv"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8stesting "k8s.io/client-go/testing"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// rvString renders a resource version the way the API serves it.
func rvString(rv int64) string { return strconv.FormatInt(rv, 10) }

// rvAgo builds a resource version in the space the API issues, dated at an age,
// so a test can assert on the lag between two versions.
func rvAgo(age time.Duration) int64 {
	return resource.ToSnowflakeRV(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).Add(-age).UnixMicro())
}

func TestAnnouncements(t *testing.T) {
	t.Run("keeps the newest version announced", func(t *testing.T) {
		older, newer, newest := rvAgo(2*time.Second), rvAgo(time.Second), rvAgo(0)
		a := newAnnouncements()
		a.Announce(testNamespace, "r", newer)
		a.Announce(testNamespace, "r", older)
		assert.Equal(t, newer, a.Announced(testNamespace, "r"))
		a.Announce(testNamespace, "r", newest)
		assert.Equal(t, newest, a.Announced(testNamespace, "r"))
	})

	t.Run("an unannounced key has nothing outstanding", func(t *testing.T) {
		a := newAnnouncements()
		a.Announce(testNamespace, "r", rvAgo(0))
		assert.Zero(t, a.Announced(testNamespace, "other"))
		assert.Zero(t, a.Announced("other-ns", "r"))
	})

	t.Run("a non-positive version announces nothing", func(t *testing.T) {
		a := newAnnouncements()
		a.Announce(testNamespace, "r", 0)
		a.Announce(testNamespace, "r", -1)
		assert.Zero(t, a.Announced(testNamespace, "r"))
	})

	// The delete leaves no version behind, so the NotFound a later read returns
	// cannot be read as a read that lagged an announcement.
	t.Run("a delete at or above the announcement forgets the key", func(t *testing.T) {
		for _, name := range []string{"same", "newer"} {
			announced := rvAgo(time.Second)
			deleted := announced
			if name == "newer" {
				deleted = rvAgo(0)
			}
			a := newAnnouncements()
			a.Announce(testNamespace, name, announced)
			a.Forget(testNamespace, name, deleted)
			assert.Zerof(t, a.Announced(testNamespace, name), "delete %s than the announcement", name)
		}
	})

	// Notifications for one key can come from different storage replicas, so
	// arrival order does not follow version order. A delete that lands after the
	// re-create superseding it must not erase the newer announcement, or the
	// reads it was there to judge stop being counted at all.
	t.Run("an out-of-order delete does not erase a newer announcement", func(t *testing.T) {
		deleted, recreated := rvAgo(time.Second), rvAgo(0)
		a := newAnnouncements()
		a.Announce(testNamespace, "r", recreated)
		a.Forget(testNamespace, "r", deleted)
		assert.Equal(t, recreated, a.Announced(testNamespace, "r"))
	})

	// Nothing to compare against, so drop the key: that can only under-count.
	t.Run("an undatable delete forgets the key", func(t *testing.T) {
		a := newAnnouncements()
		a.Announce(testNamespace, "r", rvAgo(0))
		a.Forget(testNamespace, "r", 0)
		assert.Zero(t, a.Announced(testNamespace, "r"))
	})

	// Legacy microsecond versions and snowflake versions have to land in one
	// comparable space, or every read of an unmigrated row looks behind.
	t.Run("versions are normalized to one space", func(t *testing.T) {
		a := newAnnouncements()
		micros := time.Now().UnixMicro()
		a.Announce(testNamespace, "r", micros)
		assert.Equal(t, resource.ToSnowflakeRV(micros), a.Announced(testNamespace, "r"))
		assert.NotEqual(t, micros, a.Announced(testNamespace, "r"), "a microsecond version should have been converted")
	})

	t.Run("an entry expires on read even with no further events", func(t *testing.T) {
		a := newAnnouncements()
		now := time.Now()
		a.now = func() time.Time { return now }
		a.Announce(testNamespace, "r", rvAgo(0))

		now = now.Add(announcementTTL - time.Second)
		require.NotZero(t, a.Announced(testNamespace, "r"))

		now = now.Add(2 * time.Second)
		assert.Zero(t, a.Announced(testNamespace, "r"))
		assert.Empty(t, a.seen, "the expired entry should be dropped, not just reported absent")
	})

	t.Run("a recorded announcement sweeps keys nobody reads", func(t *testing.T) {
		a := newAnnouncements()
		now := time.Now()
		a.now = func() time.Time { return now }
		a.Announce(testNamespace, "stale", rvAgo(time.Second))

		now = now.Add(announcementTTL + time.Minute)
		a.Announce(testNamespace, "fresh", rvAgo(0))

		assert.NotZero(t, a.Announced(testNamespace, "fresh"))
		assert.Len(t, a.seen, 1, "the aged-out key should have been swept")
	})

	t.Run("re-announcing refreshes the age", func(t *testing.T) {
		a := newAnnouncements()
		now := time.Now()
		a.now = func() time.Time { return now }
		rv := rvAgo(0)
		a.Announce(testNamespace, "r", rv)

		// Same version re-announced just before expiry: still live evidence.
		now = now.Add(announcementTTL - time.Second)
		a.Announce(testNamespace, "r", rv)
		now = now.Add(2 * time.Second)
		assert.NotZero(t, a.Announced(testNamespace, "r"))
	})
}

// freshnessCount reads one outcome counter for a resource.
func freshnessCount(t *testing.T, reg *prometheus.Registry, resourceName, outcome string) float64 {
	t.Helper()
	return counterValue(t, reg, "grafana_provisioning_reconcile_read_freshness_total",
		map[string]string{"resource": resourceName, "outcome": outcome})
}

// lagObservations returns the count and sum of the lag histogram for a resource.
func lagObservations(t *testing.T, reg *prometheus.Registry, resourceName string) (uint64, float64) {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, mf := range families {
		if mf.GetName() != "grafana_provisioning_reconcile_read_version_lag_seconds" {
			continue
		}
		for _, m := range mf.GetMetric() {
			for _, l := range m.GetLabel() {
				if l.GetName() == "resource" && l.GetValue() == resourceName {
					return m.GetHistogram().GetSampleCount(), m.GetHistogram().GetSampleSum()
				}
			}
		}
	}
	return 0, 0
}

func newFreshnessRecorder(t *testing.T, resourceName string) (FreshnessRecorder, *prometheus.Registry) {
	t.Helper()
	reg := prometheus.NewRegistry()
	return NewFreshnessMetrics(reg).Recorder(resourceName), reg
}

func TestFreshnessRecorder_Observe(t *testing.T) {
	const res = "repositories"
	ctx := context.Background()
	notFound := apierrors.NewNotFound(schema.GroupResource{Resource: res}, "r")

	t.Run("a read at or above the announced version is current", func(t *testing.T) {
		announced := rvAgo(time.Second)
		for _, observed := range []int64{announced, rvAgo(0)} {
			rec, reg := newFreshnessRecorder(t, res)
			rec.observe(ctx, testNamespace, "r", announced, repoAt(testNamespace, "r", rvString(observed)), nil)
			assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeCurrent))
			assert.Zero(t, freshnessCount(t, reg, res, outcomeBehind))
		}
	})

	t.Run("a read below the announced version is behind, sized by the version timestamps", func(t *testing.T) {
		rec, reg := newFreshnessRecorder(t, res)
		announced, observed := rvAgo(0), rvAgo(5*time.Second)
		rec.observe(ctx, testNamespace, "r", announced, repoAt(testNamespace, "r", rvString(observed)), nil)

		assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeBehind))
		assert.Zero(t, freshnessCount(t, reg, res, outcomeCurrent))
		count, sum := lagObservations(t, reg, res)
		assert.Equal(t, uint64(1), count)
		assert.InDelta(t, 5.0, sum, 1.0)
	})

	// Snowflake versions carry a millisecond timestamp plus sequence bits, so two
	// writes in the same millisecond are ordered but equally dated. The histogram
	// has to keep that observation, or it stays empty while behind climbs.
	t.Run("a sub-millisecond lag is still observed", func(t *testing.T) {
		rec, reg := newFreshnessRecorder(t, res)
		micros := time.Now().UnixMicro()
		micros -= micros % 1000
		observed, announced := resource.ToSnowflakeRV(micros+100), resource.ToSnowflakeRV(micros+900)
		require.Less(t, observed, announced, "the versions must be ordered")
		require.Equal(t, resource.ResourceVersionTime(announced), resource.ResourceVersionTime(observed),
			"the versions must share a millisecond")

		rec.observe(ctx, testNamespace, "r", announced, repoAt(testNamespace, "r", rvString(observed)), nil)

		assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeBehind))
		count, sum := lagObservations(t, reg, res)
		assert.Equal(t, uint64(1), count, "every behind read must produce a lag observation")
		assert.Zero(t, sum)
	})

	// The execution Rafael Paulovic reproduced against real storage: an object
	// announced, then legitimately deleted, whose correct NotFound must not be
	// dressed up as a lagging read. The announcement is already forgotten by the
	// delete in the live path; even when one is outstanding — because the DELETED
	// was round-robined to another replica — the 404 gets its own outcome.
	t.Run("a NotFound is never counted as behind", func(t *testing.T) {
		rec, reg := newFreshnessRecorder(t, res)
		rec.observe(ctx, testNamespace, "r", rvAgo(0), nil, notFound)

		assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeNotFound))
		assert.Zero(t, freshnessCount(t, reg, res, outcomeBehind))
		assert.Zero(t, freshnessCount(t, reg, res, outcomeCurrent))
		count, _ := lagObservations(t, reg, res)
		assert.Zero(t, count)
	})

	t.Run("a read with no announcement outstanding is not counted", func(t *testing.T) {
		rec, reg := newFreshnessRecorder(t, res)
		rec.observe(ctx, testNamespace, "r", 0, repoAt(testNamespace, "r", rvString(rvAgo(0))), nil)
		rec.observe(ctx, testNamespace, "r", 0, nil, notFound)

		for _, outcome := range []string{outcomeCurrent, outcomeBehind, outcomeNotFound} {
			assert.Zerof(t, freshnessCount(t, reg, res, outcome), "outcome %q", outcome)
		}
	})

	t.Run("a failure other than NotFound is not counted", func(t *testing.T) {
		rec, reg := newFreshnessRecorder(t, res)
		rec.observe(ctx, testNamespace, "r", rvAgo(0), nil, apierrors.NewServiceUnavailable("down"))

		for _, outcome := range []string{outcomeCurrent, outcomeBehind, outcomeNotFound} {
			assert.Zerof(t, freshnessCount(t, reg, res, outcome), "outcome %q", outcome)
		}
	})

	t.Run("an unparseable version is not counted", func(t *testing.T) {
		rec, reg := newFreshnessRecorder(t, res)
		announced := rvAgo(0)
		rec.observe(ctx, testNamespace, "r", announced, repoAt(testNamespace, "r", ""), nil)
		rec.observe(ctx, testNamespace, "r", announced, repoAt(testNamespace, "r", "not-a-version"), nil)

		for _, outcome := range []string{outcomeCurrent, outcomeBehind, outcomeNotFound} {
			assert.Zerof(t, freshnessCount(t, reg, res, outcome), "outcome %q", outcome)
		}
	})

	// All three series exist from the start, so "nothing came back behind" reads
	// as a flat zero rather than as a missing series.
	t.Run("the outcome series are created at zero", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		NewFreshnessMetrics(reg).Recorder(res)

		families, err := reg.Gather()
		require.NoError(t, err)
		for _, mf := range families {
			if mf.GetName() == "grafana_provisioning_reconcile_read_freshness_total" {
				assert.Len(t, mf.GetMetric(), 3)
				return
			}
		}
		t.Fatal("the freshness counter family was not registered")
	})

	t.Run("the zero recorder discards", func(t *testing.T) {
		var rec FreshnessRecorder
		assert.NotPanics(t, func() {
			rec.observe(ctx, testNamespace, "r", rvAgo(0), repoAt(testNamespace, "r", rvString(rvAgo(time.Second))), nil)
		})
	})

	t.Run("nil metrics yield a discarding recorder", func(t *testing.T) {
		var m *FreshnessMetrics
		assert.NotPanics(t, func() {
			m.Recorder(res).observe(ctx, testNamespace, "r", rvAgo(0), repoAt(testNamespace, "r", rvString(rvAgo(time.Second))), nil)
		})
	})
}

// fixedAnnouncements answers with one version regardless of key, and records how
// many times it was asked, so a test can prove when the sample is taken.
type fixedAnnouncements struct {
	rv    int64
	calls int
	onGet func()
}

func (f *fixedAnnouncements) Announced(string, string) int64 {
	f.calls++
	if f.onGet != nil {
		f.onGet()
	}
	return f.rv
}

// stubRepositoryGetter is a RepositoryGetter whose Get is scripted.
type stubRepositoryGetter struct {
	RepositoryGetter
	get func(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error)
}

func (s stubRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	return s.get(ctx, namespace, name)
}

func TestObserveRepositoryFreshness(t *testing.T) {
	const res = "repositories"
	ctx := context.Background()

	t.Run("passes the result through untouched", func(t *testing.T) {
		want := repoAt(testNamespace, "r", rvString(rvAgo(0)))
		inner := stubRepositoryGetter{get: func(context.Context, string, string) (*provisioningapis.Repository, error) {
			return want, nil
		}}
		rec, _ := newFreshnessRecorder(t, res)

		got, err := observeRepositoryFreshness(inner, &fixedAnnouncements{rv: rvAgo(0)}, rec).Get(ctx, testNamespace, "r")
		require.NoError(t, err)
		assert.Same(t, want, got)
	})

	t.Run("passes a NotFound through untouched", func(t *testing.T) {
		notFound := apierrors.NewNotFound(schema.GroupResource{Resource: res}, "r")
		inner := stubRepositoryGetter{get: func(context.Context, string, string) (*provisioningapis.Repository, error) {
			return nil, notFound
		}}
		rec, reg := newFreshnessRecorder(t, res)

		_, err := observeRepositoryFreshness(inner, &fixedAnnouncements{rv: rvAgo(0)}, rec).Get(ctx, testNamespace, "r")
		assert.Same(t, notFound, err)
		assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeNotFound))
	})

	// The legal execution Rafael Paulovic called out: a read already in flight
	// when a newer write commits may return the earlier state. Sampling the
	// announcement before the read is what keeps that out of the counter — an
	// announcement that lands mid-read is simply not compared against.
	t.Run("an announcement that lands mid-read is not counted", func(t *testing.T) {
		announced := &fixedAnnouncements{rv: 0}
		inner := stubRepositoryGetter{get: func(context.Context, string, string) (*provisioningapis.Repository, error) {
			// The concurrent write commits and is announced while the read runs.
			announced.rv = rvAgo(0)
			return repoAt(testNamespace, "r", rvString(rvAgo(5*time.Second))), nil
		}}
		rec, reg := newFreshnessRecorder(t, res)

		_, err := observeRepositoryFreshness(inner, announced, rec).Get(ctx, testNamespace, "r")
		require.NoError(t, err)
		for _, outcome := range []string{outcomeCurrent, outcomeBehind, outcomeNotFound} {
			assert.Zerof(t, freshnessCount(t, reg, res, outcome), "outcome %q", outcome)
		}
		assert.Equal(t, 1, announced.calls, "the announcement should be sampled once, before the read")
	})

	// A getter the wrapper does not own still answers the quota methods.
	t.Run("forwards the rest of the getter", func(t *testing.T) {
		client := fake.NewClientset(repo(testNamespace, "r")).ProvisioningV0alpha1()
		inner := NewClientRepositoryGetter(client, seededSnapshot(repo(testNamespace, "r")))
		rec, _ := newFreshnessRecorder(t, res)

		wrapped := observeRepositoryFreshness(inner, &fixedAnnouncements{}, rec)
		count, err := wrapped.CountRepositories(ctx, testNamespace)
		require.NoError(t, err)
		assert.Equal(t, 1, count)
	})
}

// End-to-end over the real informer: the notification raises the announcement,
// the getter the same delta source returns compares its read against it.
func TestNewRepositoryDeltaSource_ObservesReadFreshness(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const res = "repositories"
		subject := resourcewatch.Subject(repoGVR, "")

		// The API serves the repository at an older version than the notification
		// announces, then catches up. This is a wiring test: the lag is injected,
		// which proves the instrumentation reports it — not that storage can
		// produce it.
		announced, stored := rvAgo(0), rvAgo(3*time.Second)
		served := &atomic.Int64{}
		served.Store(stored)
		client := fake.NewClientset()
		client.PrependReactor("get", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
			return true, repoAt(testNamespace, "r", rvString(served.Load())), nil
		})

		reg := prometheus.NewRegistry()
		sub := newFakeSubscriber()
		source, getter, err := NewRepositoryDeltaSource(sub, client, nil, time.Minute, nil, NewFreshnessMetrics(reg))
		require.NoError(t, err)

		stop := make(chan struct{})
		t.Cleanup(func() { close(stop) })
		go source.Run(stop)

		// Complete initial listing and establish the subscription before publishing notifications.
		synctest.Wait()

		require.True(t, sub.subscribed(subject))

		ctx := context.Background()
		// Before any notification there is nothing to compare against.
		_, err = getter.Get(ctx, testNamespace, "r")
		require.NoError(t, err)
		assert.Zero(t, freshnessCount(t, reg, res, outcomeCurrent))
		assert.Zero(t, freshnessCount(t, reg, res, outcomeBehind))

		sub.publish(t, subject, &resourcepb.WatchNotification{
			Type: resourcepb.WatchNotification_MODIFIED, Namespace: testNamespace, Name: "r", ResourceVersion: announced,
		})

		// The informer applies a live event off the delivery path, so let the announcement land before reading.
		synctest.Wait()

		_, err = getter.Get(ctx, testNamespace, "r")
		require.NoError(t, err)
		assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeBehind))
		count, sum := lagObservations(t, reg, res)
		assert.Equal(t, uint64(1), count)
		assert.InDelta(t, 3.0, sum, 1.0)

		// Once the API catches up, the same read is current.
		served.Store(announced)
		_, err = getter.Get(ctx, testNamespace, "r")
		require.NoError(t, err)
		assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeCurrent))
		assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeBehind), "the earlier observation stands on its own")
	})
}

// The create -> delete -> queued read case, end to end: the DELETED forgets the
// announcement, so the correct NotFound the queued read returns is not counted
// at all — not as behind, and not even as the ambiguous not_found.
func TestNewRepositoryDeltaSource_DeleteLeavesNoAnnouncement(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const res = "repositories"
		subject := resourcewatch.Subject(repoGVR, "")
		client := fake.NewClientset()

		reg := prometheus.NewRegistry()
		sub := newFakeSubscriber()
		source, getter, err := NewRepositoryDeltaSource(sub, client, nil, time.Minute, nil, NewFreshnessMetrics(reg))
		require.NoError(t, err)

		stop := make(chan struct{})
		t.Cleanup(func() { close(stop) })
		go source.Run(stop)

		// Complete initial listing and establish the subscription before publishing notifications.
		synctest.Wait()

		require.True(t, sub.subscribed(subject))

		added, deleted := rvAgo(2*time.Second), rvAgo(time.Second)
		for _, evt := range []*resourcepb.WatchNotification{
			{Type: resourcepb.WatchNotification_ADDED, Namespace: testNamespace, Name: "r", ResourceVersion: added},
			{Type: resourcepb.WatchNotification_DELETED, Namespace: testNamespace, Name: "r", ResourceVersion: deleted},
		} {
			sub.publish(t, subject, evt)
		}

		_, err = getter.Get(context.Background(), testNamespace, "r")
		assert.True(t, apierrors.IsNotFound(err), "the object is gone; the read must still 404")
		for _, outcome := range []string{outcomeCurrent, outcomeBehind, outcomeNotFound} {
			assert.Zerof(t, freshnessCount(t, reg, res, outcome), "outcome %q", outcome)
		}
	})
}

// The getter the apiserver path returns is not wrapped: a watch-fed cache has no
// cross-replica read visibility to measure.
func TestNewRepositoryDeltaSource_NoFreshnessOnTheAPIServerPath(t *testing.T) {
	_, getter, err := NewRepositoryDeltaSource(nil, fake.NewClientset(), nil, time.Minute, nil, NewFreshnessMetrics(prometheus.NewRegistry()))
	require.NoError(t, err)
	assert.IsType(t, cachedRepositoryGetter{}, getter)
}

func TestNewConnectionDeltaSource_ObservesReadFreshness(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const res = "connections"
		subject := resourcewatch.Subject(connGVR, "")

		announced, stored := rvAgo(0), rvAgo(3*time.Second)
		conn := &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{
			Namespace: testNamespace, Name: "c", ResourceVersion: rvString(stored),
		}}
		client := fake.NewClientset(conn)

		reg := prometheus.NewRegistry()
		sub := newFakeSubscriber()
		source, getter, err := NewConnectionDeltaSource(sub, client, nil, time.Minute, nil, NewFreshnessMetrics(reg))
		require.NoError(t, err)

		stop := make(chan struct{})
		t.Cleanup(func() { close(stop) })
		go source.Run(stop)

		// Complete initial listing and establish the subscription before publishing notifications.
		synctest.Wait()

		require.True(t, sub.subscribed(subject))

		sub.publish(t, subject, &resourcepb.WatchNotification{
			Type: resourcepb.WatchNotification_MODIFIED, Namespace: testNamespace, Name: "c", ResourceVersion: announced,
		})

		// The informer applies a live event off the delivery path, so let the announcement land before reading.
		synctest.Wait()

		_, err = getter.Get(context.Background(), testNamespace, "c")
		require.NoError(t, err)
		assert.Equal(t, float64(1), freshnessCount(t, reg, res, outcomeBehind))
	})
}

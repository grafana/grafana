package informer

import (
	"context"
	"strconv"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8stesting "k8s.io/client-go/testing"

	sdkresource "github.com/grafana/grafana-app-sdk/resource"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
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

// freshnessCount reads one outcome counter for a resource.
func freshnessCount(t *testing.T, reg *prometheus.Registry, resourceName, outcome string) float64 {
	t.Helper()
	gvk := resourceInfoFor(t, resourceName).GroupVersionKind()
	return counterValue(t, reg, "grafana_provisioning_informer_read_freshness_total",
		map[string]string{"group": gvk.Group, "version": gvk.Version, "kind": gvk.Kind, "outcome": outcome})
}

// lagObservations returns the count and sum of the lag histogram for a resource.
func lagObservations(t *testing.T, reg *prometheus.Registry, resourceName string) (uint64, float64) {
	t.Helper()
	gvk := resourceInfoFor(t, resourceName).GroupVersionKind()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, mf := range families {
		if mf.GetName() != "grafana_provisioning_informer_read_version_lag_seconds" {
			continue
		}
		for _, m := range mf.GetMetric() {
			for _, l := range m.GetLabel() {
				if l.GetName() == "kind" && l.GetValue() == gvk.Kind {
					return m.GetHistogram().GetSampleCount(), m.GetHistogram().GetSampleSum()
				}
			}
		}
	}
	return 0, 0
}

func newFreshnessRecorder(t *testing.T, resourceName string) (operator.FreshnessRecorder, *prometheus.Registry) {
	t.Helper()
	reg := prometheus.NewRegistry()
	return NewFreshnessMetrics(reg).Recorder(usinformer.SDKKind(resourceInfoFor(t, resourceName))), reg
}

// resourceInfoFor maps the resource a test names to the kind the metrics are labelled by.
func resourceInfoFor(t *testing.T, resourceName string) usinformer.ResourceInfo {
	t.Helper()
	switch resourceName {
	case "repositories":
		return &provisioningapis.RepositoryResourceInfo
	case "connections":
		return &provisioningapis.ConnectionResourceInfo
	}
	t.Fatalf("no resource info for %q", resourceName)
	return nil
}

// The outcome label values the SDK records, which it does not export.
const (
	outcomeCurrent  = "current"
	outcomeBehind   = "behind"
	outcomeNotFound = "not_found"
)

// fixedAnnouncements answers with one version regardless of key, and records how
// many times it was asked, so a test can prove when the sample is taken.
type fixedAnnouncements struct {
	rv    int64
	calls int
	onGet func()
}

func (f *fixedAnnouncements) Announced(sdkresource.Identifier) int64 {
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

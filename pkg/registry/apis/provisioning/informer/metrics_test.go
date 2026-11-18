package informer

import (
	"maps"
	"strconv"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/tools/cache"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// recentRV returns a resource version issued about a second ago: below the
// snowflake threshold it is read as a microsecond Unix timestamp, so the
// derived latency is a small positive number.
func recentRV() int64 {
	return time.Now().Add(-time.Second).UnixMicro()
}

func objWithRV(name string, rv int64) *metav1.PartialObjectMetadata {
	o := &metav1.PartialObjectMetadata{}
	o.Name = name
	o.Namespace = "default"
	if rv != 0 {
		o.ResourceVersion = strconv.FormatInt(rv, 10)
	}
	return o
}

// histogramSamples returns the sample count of the named histogram for one
// label set, 0 when the series does not exist.
func histogramSamples(t *testing.T, reg *prometheus.Registry, name string, labels map[string]string) uint64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, mf := range families {
		if mf.GetName() != name {
			continue
		}
		for _, metric := range mf.GetMetric() {
			got := map[string]string{}
			for _, lp := range metric.GetLabel() {
				got[lp.GetName()] = lp.GetValue()
			}
			if maps.Equal(got, labels) {
				return metric.GetHistogram().GetSampleCount()
			}
		}
	}
	return 0
}

// The NATS recorder counts live and re-list deliveries on their own metric
// families, derives latency from the RV's embedded timestamp (rv=0 means no
// sample), and drives the active-subscriptions gauge.
func TestNATSRecorder(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newInformerMetrics(reg)
	r := newNATSRecorder(m, "jobs")

	r.ObserveLiveEvent(usinformer.VerbAdd, recentRV())
	r.ObserveRelistEvent(usinformer.VerbAdd, recentRV())
	r.ObserveRelistEvent(usinformer.VerbUpdate, 0)
	r.ObserveReconnect()

	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", "add")))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.relistEvents.WithLabelValues("jobs", "add")))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.relistEvents.WithLabelValues("jobs", "update")))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.reconnects.WithLabelValues("jobs")))

	labels := map[string]string{"resource": "jobs"}
	assert.EqualValues(t, 1, histogramSamples(t, reg, "grafana_provisioning_informer_live_event_latency_seconds", labels),
		"a live event with an RV must produce a live latency sample")
	assert.EqualValues(t, 1, histogramSamples(t, reg, "grafana_provisioning_informer_relist_event_latency_seconds", labels),
		"a relist-recovered add with an RV must produce a relist latency sample")

	r.ObserveLiveEvent(usinformer.VerbDelete, 0)
	assert.EqualValues(t, 1, histogramSamples(t, reg, "grafana_provisioning_informer_live_event_latency_seconds", labels),
		"rv=0 must not produce a latency sample")

	// The gauge counts each informer once: the pre-subscribe false is a no-op,
	// opening increments, repeat opens are idempotent, and closing decrements.
	r.ObserveLiveSubscription(false)
	assert.Equal(t, 0.0, testutil.ToFloat64(m.natsSubscriptions), "a close before any open must not go negative")
	r.ObserveLiveSubscription(true)
	r.ObserveLiveSubscription(true)
	assert.Equal(t, 1.0, testutil.ToFloat64(m.natsSubscriptions), "an open counts once, repeat opens are idempotent")
	r.ObserveLiveSubscription(false)
	assert.Equal(t, 0.0, testutil.ToFloat64(m.natsSubscriptions))
}

// The apiserver meter classifies deliveries the informer does not label itself:
// initial-list adds, resync re-deliveries (same RV on both sides), and
// re-list-detected deletes count on the relist family; everything else is live.
func TestAPIServerMeter(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newInformerMetrics(reg)
	h := apiServerMeter{metrics: m, resourceName: "jobs"}

	old := objWithRV("x", recentRV())
	updated := objWithRV("x", recentRV()+1)

	h.OnAdd(objWithRV("a", recentRV()), true)                                                     // initial list
	h.OnAdd(objWithRV("b", recentRV()), false)                                                    // live watch add
	h.OnUpdate(old, old)                                                                          // resync replay: same object, same RV
	h.OnUpdate(old, updated)                                                                      // live update
	h.OnDelete(objWithRV("c", recentRV()))                                                        // live delete
	h.OnDelete(cache.DeletedFinalStateUnknown{Key: "default/d", Obj: objWithRV("d", recentRV())}) // re-list-detected delete

	for _, verb := range []string{"add", "update", "delete"} {
		assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", verb)), "live_events{verb=%s}", verb)
		assert.Equal(t, 1.0, testutil.ToFloat64(m.relistEvents.WithLabelValues("jobs", verb)), "relist_events{verb=%s}", verb)
	}

	labels := map[string]string{"resource": "jobs"}
	assert.EqualValues(t, 3, histogramSamples(t, reg, "grafana_provisioning_informer_live_event_latency_seconds", labels),
		"live add, update and delete must each produce a latency sample")
	assert.EqualValues(t, 0, histogramSamples(t, reg, "grafana_provisioning_informer_relist_event_latency_seconds", labels),
		"initial adds, resync re-deliveries and stale deletes carry no latency")
}

// One instance serves every recorder in a delta source, each passing its own
// resource label.
func TestNewInformerMetrics_SharedByRecorders(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newInformerMetrics(reg)

	newNATSRecorder(m, "jobs").ObserveLiveEvent(usinformer.VerbAdd, 0)
	apiServerMeter{metrics: m, resourceName: "repositories"}.OnAdd(&unstructured.Unstructured{}, false)

	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", usinformer.VerbAdd)))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("repositories", usinformer.VerbAdd)))
}

// The re-list request counter counts one LIST request per page, so a snapshot
// that spans several pages records several increments.
func TestInformerMetrics_RelistRequests(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newInformerMetrics(reg)

	m.observeRelistRequest("jobs")
	m.observeRelistRequest("jobs")
	m.observeRelistRequest("jobs")

	assert.Equal(t, 3.0, testutil.ToFloat64(m.relistRequests.WithLabelValues("jobs")))
}

// The subscription gauge totals across informers: each recorder owns its own
// dedupe state but shares the collector, so concurrently-open subscriptions add
// up and each closes independently.
func TestNATSRecorder_SubscriptionGaugeTotalsAcrossInformers(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newInformerMetrics(reg)
	jobs := newNATSRecorder(m, "jobs")
	repos := newNATSRecorder(m, "repositories")

	jobs.ObserveLiveSubscription(true)
	repos.ObserveLiveSubscription(true)
	assert.Equal(t, 2.0, testutil.ToFloat64(m.natsSubscriptions), "both open subscriptions count")

	jobs.ObserveLiveSubscription(false)
	assert.Equal(t, 1.0, testutil.ToFloat64(m.natsSubscriptions), "closing one leaves the other")
}

// A nil registerer disables registration but the collectors stay usable, so a
// caller without a registry needs no special casing.
func TestNewInformerMetrics_NilRegisterer(t *testing.T) {
	m := newInformerMetrics(nil)
	m.observeLive("jobs", usinformer.VerbAdd, recentRV())
	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", "add")))
}

// The rollout is read off this counter, so the labels it reports are part of the
// contract: a dashboard filtering projection="keys" has to see the keys path and
// only the keys path.
func TestRelistProjectionMetrics_ReportsTheProjection(t *testing.T) {
	reg := prometheus.NewRegistry()
	// The job delta source already owns the delivery metrics on this registry; the
	// projection collectors are separate, so they do not collide.
	_ = newInformerMetrics(reg)
	recorder := NewRelistProjectionMetrics(reg).Recorder(connGVR)

	recorder.Projection(true)
	recorder.Projection(true)
	recorder.Projection(false)

	assert.Equal(t, float64(2), projectionCount(t, reg, connGVR, "keys"))
	assert.Equal(t, float64(1), projectionCount(t, reg, connGVR, "objects"))
}

// The group is part of the series identity: the keys projection is a
// unified-storage feature that any group can report here, so a query that reads
// only the resource name would silently sum two of them together.
//
// Binding the recorder also creates both projections at zero, so the fallback
// series exists before anything falls back.
func TestRelistProjectionMetrics_LabelsTheGroup(t *testing.T) {
	reg := prometheus.NewRegistry()
	NewRelistProjectionMetrics(reg).Recorder(connGVR).Projection(true)

	assert.ElementsMatch(t, []map[string]string{
		{"group": connGVR.Group, "resource": connGVR.Resource, "projection": "keys"},
		{"group": connGVR.Group, "resource": connGVR.Resource, "projection": "objects"},
	}, projectionLabelSets(t, reg))

	assert.Equal(t, float64(1), projectionCount(t, reg, connGVR, "keys"))
	assert.Zero(t, projectionCount(t, reg, connGVR, "objects"), "present, and zero until it fires")
}

// The collectors are shared by every delta source, so one registry has to serve
// them all; registering per source would panic on the second.
func TestRelistProjectionMetrics_SharedAcrossResources(t *testing.T) {
	reg := prometheus.NewRegistry()
	metrics := NewRelistProjectionMetrics(reg)

	metrics.Recorder(connGVR).Projection(true)
	metrics.Recorder(repoGVR).Projection(false)

	assert.Equal(t, float64(1), projectionCount(t, reg, connGVR, "keys"))
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "objects"))
	assert.Zero(t, projectionCount(t, reg, connGVR, "objects"), "the resources must not share a series")
}

// A delta source built without metrics records nothing rather than panicking.
func TestRelistRecorder_ZeroValueDiscards(t *testing.T) {
	var recorder RelistRecorder
	recorder.Projection(true)
}

// projectionLabelSets returns the label sets of every projection series in reg.
func projectionLabelSets(t *testing.T, reg *prometheus.Registry) []map[string]string {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)

	var out []map[string]string
	for _, mf := range families {
		if mf.GetName() != "grafana_provisioning_informer_relist_projection_total" {
			continue
		}
		for _, m := range mf.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			out = append(out, labels)
		}
	}
	return out
}

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
// families under source=nats, derives latency from the RV's embedded timestamp
// (rv=0 means no sample), and drives the live-subscription gauge.
func TestNATSRecorder(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newInformerMetrics(reg)
	r := natsRecorder{metrics: m, resourceName: "jobs"}

	r.ObserveLiveEvent(usinformer.VerbAdd, recentRV())
	r.ObserveRelistEvent(usinformer.VerbAdd, recentRV())
	r.ObserveRelistEvent(usinformer.VerbUpdate, 0)
	r.ObserveReconnect()

	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", "nats", "add")))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.relistEvents.WithLabelValues("jobs", "nats", "add")))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.relistEvents.WithLabelValues("jobs", "nats", "update")))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.reconnects.WithLabelValues("jobs")))

	natsLabels := map[string]string{"resource": "jobs", "source": "nats"}
	assert.EqualValues(t, 1, histogramSamples(t, reg, "grafana_provisioning_informer_live_event_latency_seconds", natsLabels),
		"a live event with an RV must produce a live latency sample")
	assert.EqualValues(t, 1, histogramSamples(t, reg, "grafana_provisioning_informer_relist_event_latency_seconds", natsLabels),
		"a relist-recovered add with an RV must produce a relist latency sample")

	r.ObserveLiveEvent(usinformer.VerbDelete, 0)
	assert.EqualValues(t, 1, histogramSamples(t, reg, "grafana_provisioning_informer_live_event_latency_seconds", natsLabels),
		"rv=0 must not produce a latency sample")

	r.ObserveLiveSubscription(true)
	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveSubscription.WithLabelValues("jobs")))
	r.ObserveLiveSubscription(false)
	assert.Equal(t, 0.0, testutil.ToFloat64(m.liveSubscription.WithLabelValues("jobs")))
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
		assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", "apiserver", verb)), "live_events{verb=%s}", verb)
		assert.Equal(t, 1.0, testutil.ToFloat64(m.relistEvents.WithLabelValues("jobs", "apiserver", verb)), "relist_events{verb=%s}", verb)
	}

	apiLabels := map[string]string{"resource": "jobs", "source": "apiserver"}
	assert.EqualValues(t, 3, histogramSamples(t, reg, "grafana_provisioning_informer_live_event_latency_seconds", apiLabels),
		"live add, update and delete must each produce a latency sample")
	assert.EqualValues(t, 0, histogramSamples(t, reg, "grafana_provisioning_informer_relist_event_latency_seconds", apiLabels),
		"initial adds, resync re-deliveries and stale deletes carry no latency")
}

// Several delta sources built against the same registry share one set of
// collectors instead of failing the duplicate registration.
func TestNewInformerMetrics_SharesCollectorsAcrossSources(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	first := newInformerMetrics(reg)
	second := newInformerMetrics(reg)

	first.liveEvents.WithLabelValues("jobs", "nats", "add").Inc()
	second.liveEvents.WithLabelValues("jobs", "nats", "add").Inc()

	assert.Equal(t, 2.0, testutil.ToFloat64(first.liveEvents.WithLabelValues("jobs", "nats", "add")),
		"both instances must write the same series")
}

// A nil registerer disables registration but the collectors stay usable, so a
// caller without a registry needs no special casing.
func TestNewInformerMetrics_NilRegisterer(t *testing.T) {
	m := newInformerMetrics(nil)
	m.observeLive(sourceNATS, "jobs", usinformer.VerbAdd, recentRV())
	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", "nats", "add")))
}

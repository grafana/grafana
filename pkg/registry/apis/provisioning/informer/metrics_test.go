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
func TestNewInformerMetrics_SharedByObservers(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newInformerMetrics(reg)

	m.observeLive("jobs", VerbAdd, 0)
	apiServerMeter{metrics: m, resourceName: "repositories"}.OnAdd(&unstructured.Unstructured{}, false)

	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", VerbAdd)))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("repositories", VerbAdd)))
}

// A nil registerer disables registration but the collectors stay usable, so a
// caller without a registry needs no special casing.
func TestNewInformerMetrics_NilRegisterer(t *testing.T) {
	m := newInformerMetrics(nil)
	m.observeLive("jobs", VerbAdd, recentRV())
	assert.Equal(t, 1.0, testutil.ToFloat64(m.liveEvents.WithLabelValues("jobs", "add")))
}

// The rollout is read off this counter, so the labels it reports are part of the
// contract: a dashboard filtering projection="keys" has to see the keys path and
// only the keys path.
// The group is part of the series identity: the keys projection is a
// unified-storage feature that any group can report here, so a query that reads
// only the resource name would silently sum two of them together.
//
// Binding the recorder also creates both projections at zero, so the fallback
// series exists before anything falls back.
// The collectors are shared by every delta source, so one registry has to serve
// them all; registering per source would panic on the second.
// A delta source built without metrics records nothing rather than panicking.

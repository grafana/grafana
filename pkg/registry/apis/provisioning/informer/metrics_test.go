package informer

import (
	"strconv"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"
)

// recentRV returns a resource version whose issue time is d in the past, so
// derived latency is a small positive value. Values below the snowflake
// threshold are interpreted as Unix microseconds by ResourceVersionTime.
func recentRV(d time.Duration) int64 {
	return time.Now().Add(-d).UnixMicro()
}

func objRV(name string, rv int64) runtime.Object {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
		Name:            name,
		ResourceVersion: strconv.FormatInt(rv, 10),
	}}
}

// countHandler is an inert inner handler; the decorator must still forward to it.
type countHandler struct{ adds, updates, deletes int }

func (h *countHandler) OnAdd(any, bool)   { h.adds++ }
func (h *countHandler) OnUpdate(any, any) { h.updates++ }
func (h *countHandler) OnDelete(any)      { h.deletes++ }

var _ cache.ResourceEventHandler = (*countHandler)(nil)

func eventCount(m *Metrics, source, res, verb, delivery string) float64 {
	return testutil.ToFloat64(m.events.WithLabelValues(source, res, verb, delivery))
}

// latencyObservations returns the number of samples the latency histogram
// recorded for the given series (0 if the series was never observed).
func latencyObservations(t *testing.T, m *Metrics, source, res, delivery string) uint64 {
	t.Helper()
	obs := m.latency.WithLabelValues(source, res, delivery)
	metric, ok := obs.(prometheus.Metric)
	require.True(t, ok)
	var dm dto.Metric
	require.NoError(t, metric.Write(&dm))
	return dm.GetHistogram().GetSampleCount()
}

// The apiserver decorator counts events under source="apiserver" and observes
// latency only for genuine changes: initial-list adds are counted without
// latency, and resync re-deliveries (unchanged RV) are skipped entirely,
// matching the NATS side.
func TestMetrics_APIServerDecorator(t *testing.T) {
	m := newMetrics(prometheus.NewPedanticRegistry())
	inner := &countHandler{}
	h := m.wrapAPIServerHandler("repositories", inner)

	h.OnAdd(objRV("a", recentRV(time.Second)), true)               // initial list: relist, no latency
	h.OnAdd(objRV("b", recentRV(time.Second)), false)              // watch add: live, latency
	h.OnUpdate(objRV("b", 100), objRV("b", recentRV(time.Second))) // real change: live, latency
	h.OnUpdate(objRV("b", 100), objRV("b", 100))                   // resync: skipped
	h.OnDelete(objRV("b", recentRV(time.Second)))                  // delete: live, latency

	const src = "apiserver"
	assert.Equal(t, float64(1), eventCount(m, src, "repositories", "add", "relist"))
	assert.Equal(t, float64(1), eventCount(m, src, "repositories", "add", "live"))
	assert.Equal(t, float64(1), eventCount(m, src, "repositories", "update", "live"))
	assert.Equal(t, float64(1), eventCount(m, src, "repositories", "delete", "live"))

	// Three live deliveries observe latency; the initial-list add and the resync do not.
	assert.Equal(t, uint64(0), latencyObservations(t, m, src, "repositories", "relist"))
	assert.Equal(t, uint64(3), latencyObservations(t, m, src, "repositories", "live"))

	// The inner handler is still driven, including the skipped-for-metrics resync.
	assert.Equal(t, 2, inner.adds)
	assert.Equal(t, 2, inner.updates)
	assert.Equal(t, 1, inner.deletes)
}

// The NATS recorder and the apiserver decorator write to disjoint source-labeled
// series, so a dashboard can compare the two mechanisms.
func TestMetrics_SourceLabelsAreDistinct(t *testing.T) {
	m := newMetrics(prometheus.NewPedanticRegistry())

	m.NATSRecorder().ObserveLiveEvent("repositories", "add", recentRV(time.Second))
	m.wrapAPIServerHandler("repositories", &countHandler{}).OnAdd(objRV("a", recentRV(time.Second)), false)

	assert.Equal(t, float64(1), eventCount(m, "nats", "repositories", "add", "live"))
	assert.Equal(t, float64(1), eventCount(m, "apiserver", "repositories", "add", "live"))
}

// Drop, relist and relist-error signals land on their own series (all NATS-only),
// and a successful relist stamps the last-success gauge — the staleness bound.
func TestMetrics_DropRelistAndStaleness(t *testing.T) {
	m := newMetrics(prometheus.NewPedanticRegistry())
	r := m.NATSRecorder()

	r.ObserveDrop("repositories", "unmarshal_error")
	r.ObserveDrop("repositories", "unknown_type")
	r.ObserveRelist("repositories", "resync")
	r.ObserveRelistError("repositories")

	assert.Equal(t, float64(1), testutil.ToFloat64(m.dropped.WithLabelValues("nats", "repositories", "unmarshal_error")))
	assert.Equal(t, float64(1), testutil.ToFloat64(m.dropped.WithLabelValues("nats", "repositories", "unknown_type")))
	assert.Equal(t, float64(1), testutil.ToFloat64(m.relists.WithLabelValues("nats", "repositories", "resync")))
	assert.Equal(t, float64(1), testutil.ToFloat64(m.relistErrors.WithLabelValues("nats", "repositories")))
	// The last-relist gauge is stamped with a real wall-clock time on success.
	assert.Greater(t, testutil.ToFloat64(m.lastRelist.WithLabelValues("nats", "repositories")), float64(0))
}

// The NATS relist recorder skips latency on the initial list (object age, not a
// delivery delay) but still counts the event.
func TestMetrics_NATSRelistInitialSkipsLatency(t *testing.T) {
	m := newMetrics(prometheus.NewPedanticRegistry())
	r := m.NATSRecorder()

	r.ObserveRelistEvent("repositories", "add", recentRV(time.Second), true)  // initial
	r.ObserveRelistEvent("repositories", "add", recentRV(time.Second), false) // steady-state

	assert.Equal(t, float64(2), eventCount(m, "nats", "repositories", "add", "relist"))
	assert.Equal(t, uint64(1), latencyObservations(t, m, "nats", "repositories", "relist"), "only the steady-state relist observes latency")
}

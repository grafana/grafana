package resources

import (
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const requestDurationMetric = "grafana_apiserver_client_request_duration_seconds"

var (
	dashboardGVR = schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1", Resource: "dashboards"}
	folderGVR    = schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1", Resource: "folders"}
)

func TestClientMetrics_NilSafe(t *testing.T) {
	var m *clientMetrics
	assert.NotPanics(t, func() {
		m.observe(dashboardGVR, operationCreate, time.Now(), nil)
	})
}

func TestClientMetrics_Observe(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newClientMetrics(reg)

	m.observe(dashboardGVR, operationCreate, time.Now(), nil)
	m.observe(dashboardGVR, operationCreate, time.Now(), errors.New("boom"))

	assert.Equal(t, uint64(1), histogramCount(t, reg, prometheus.Labels{
		"group":     dashboardGVR.Group,
		"resource":  dashboardGVR.Resource,
		"operation": operationCreate,
		"outcome":   outcomeSuccess,
	}))
	assert.Equal(t, uint64(1), histogramCount(t, reg, prometheus.Labels{
		"group":     dashboardGVR.Group,
		"resource":  dashboardGVR.Resource,
		"operation": operationCreate,
		"outcome":   outcomeError,
	}))
}

// TestClientMetrics_RepeatConstructionOnSameRegistry covers the real wiring: this
// factory is built several times against one registry — NewAPIBuilder runs once
// per API version (v0alpha1 and v1beta1), the webhooks builder likewise, and
// zanzana builds its own — so newClientMetrics must reuse the registered
// collector rather than panic, and every instance must write to one series.
func TestClientMetrics_RepeatConstructionOnSameRegistry(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()

	var first, second *clientMetrics
	require.NotPanics(t, func() {
		first = newClientMetrics(reg)
		second = newClientMetrics(reg)
	})

	first.observe(dashboardGVR, operationGet, time.Now(), nil)
	second.observe(dashboardGVR, operationGet, time.Now(), nil)

	// Both instances share one collector, so the observations land on one series.
	assert.Equal(t, uint64(2), histogramCount(t, reg, prometheus.Labels{
		"group":     dashboardGVR.Group,
		"resource":  dashboardGVR.Resource,
		"operation": operationGet,
		"outcome":   outcomeSuccess,
	}))
}

// TestClientMetrics_LabelContract pins the exact label set. WithLabelValues is
// positional and unchecked, so a label added or reordered on one side only would
// otherwise silently mislabel every observation.
func TestClientMetrics_LabelContract(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newClientMetrics(reg)
	m.observe(folderGVR, operationDeleteCollection, time.Now(), errors.New("boom"))

	metric := findMetric(t, reg, prometheus.Labels{
		"group":     folderGVR.Group,
		"resource":  folderGVR.Resource,
		"operation": operationDeleteCollection,
		"outcome":   outcomeError,
	})
	require.NotNil(t, metric, "no series matched the expected label set")

	got := make([]string, 0, len(metric.GetLabel()))
	for _, l := range metric.GetLabel() {
		got = append(got, l.GetName())
	}
	// Gathered labels are sorted by name.
	assert.Equal(t, []string{"group", "operation", "outcome", "resource"}, got)
}

func TestRegisterOrReuse(t *testing.T) {
	t.Run("returns the collector unregistered when reg is nil", func(t *testing.T) {
		c := prometheus.NewCounter(prometheus.CounterOpts{Name: "test_total"})
		assert.Equal(t, c, registerOrReuse(nil, c))
	})

	t.Run("reuses an already-registered collector", func(t *testing.T) {
		reg := prometheus.NewPedanticRegistry()
		opts := prometheus.CounterOpts{Name: "test_total"}
		first := registerOrReuse(reg, prometheus.NewCounter(opts))
		second := registerOrReuse(reg, prometheus.NewCounter(opts))
		assert.Same(t, first, second)
	})

	t.Run("does not panic when a wrapping registerer returns a wrapped collector", func(t *testing.T) {
		// prometheus does not unwrap AlreadyRegisteredError through a wrapping
		// registerer, so ExistingCollector is not of the requested type. That must
		// degrade rather than panic: this path runs on every API server call.
		reg := prometheus.WrapRegistererWith(prometheus.Labels{"wrapped": "yes"}, prometheus.NewPedanticRegistry())
		opts := prometheus.CounterOpts{Name: "test_total"}
		require.NotPanics(t, func() {
			registerOrReuse(reg, prometheus.NewCounter(opts))
			registerOrReuse(reg, prometheus.NewCounter(opts))
		})
	})
}

// histogramCount returns the sample count of the request-duration histogram for
// the series matching want, or 0 when no series matches.
func histogramCount(t *testing.T, reg *prometheus.Registry, want prometheus.Labels) uint64 {
	t.Helper()
	if m := findMetric(t, reg, want); m != nil {
		return m.GetHistogram().GetSampleCount()
	}
	return 0
}

// findMetric locates the request-duration series whose labels match want. Labels
// are matched by name via a map so the test cannot reproduce the positional
// WithLabelValues footgun it exists to catch.
func findMetric(t *testing.T, reg *prometheus.Registry, want prometheus.Labels) *dto.Metric {
	t.Helper()

	families, err := reg.Gather()
	require.NoError(t, err)

	for _, mf := range families {
		if mf.GetName() != requestDurationMetric {
			continue
		}
		for _, metric := range mf.GetMetric() {
			if labelsMatch(metric.GetLabel(), want) {
				return metric
			}
		}
	}
	return nil
}

func labelsMatch(labels []*dto.LabelPair, want prometheus.Labels) bool {
	got := make(map[string]string, len(labels))
	for _, l := range labels {
		got[l.GetName()] = l.GetValue()
	}
	for k, v := range want {
		if got[k] != v {
			return false
		}
	}
	return true
}

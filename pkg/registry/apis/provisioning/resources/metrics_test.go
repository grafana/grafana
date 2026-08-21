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

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
)

func TestClientMetrics_NilSafe(t *testing.T) {
	var m *clientMetrics
	assert.NotPanics(t, func() {
		m.observe(schema.GroupVersionResource{Resource: "dashboards"}, operationCreate, time.Now(), nil)
	})
}

func TestClientMetrics_Observe(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := newClientMetrics(reg)

	gvr := schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1", Resource: "dashboards"}
	m.observe(gvr, operationCreate, time.Now(), nil)
	m.observe(gvr, operationCreate, time.Now(), errors.New("boom"))

	assert.Equal(t, uint64(1), histogramCountFor(t, reg,
		"dashboard.grafana.app", "dashboards", operationCreate, utils.SuccessOutcome))
	assert.Equal(t, uint64(1), histogramCountFor(t, reg,
		"dashboard.grafana.app", "dashboards", operationCreate, utils.ErrorOutcome))
}

// histogramCountFor returns the sample count of the request-duration histogram
// for the given {group, resource, operation, outcome} label set.
func histogramCountFor(t *testing.T, reg *prometheus.Registry, group, resource, operation, outcome string) uint64 {
	t.Helper()

	families, err := reg.Gather()
	require.NoError(t, err)

	for _, mf := range families {
		if mf.GetName() != "grafana_provisioning_apiserver_request_duration_seconds" {
			continue
		}
		for _, metric := range mf.GetMetric() {
			if labelsMatch(metric.GetLabel(), map[string]string{
				"group":     group,
				"resource":  resource,
				"operation": operation,
				"outcome":   outcome,
			}) {
				return metric.GetHistogram().GetSampleCount()
			}
		}
	}
	return 0
}

func labelsMatch(labels []*dto.LabelPair, want map[string]string) bool {
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

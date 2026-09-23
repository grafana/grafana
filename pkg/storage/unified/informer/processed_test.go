package informer

import (
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProcessedMetrics_ClassifyAdd(t *testing.T) {
	tests := []struct {
		name            string
		resourceVersion string
		isInInitialList bool
		natsBacked      bool
		want            ProcessTrigger
	}{
		{name: "minimal add is live (nats)", resourceVersion: "", natsBacked: true, want: TriggerLive},
		{name: "minimal add is live (apiserver)", resourceVersion: "", natsBacked: false, want: TriggerLive},
		{name: "initial list add is initial", resourceVersion: "5", isInInitialList: true, natsBacked: true, want: TriggerInitial},
		{name: "full-RV non-initial add is relist under nats", resourceVersion: "5", natsBacked: true, want: TriggerRelist},
		{name: "full-RV non-initial add is live under apiserver", resourceVersion: "5", natsBacked: false, want: TriggerLive},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewProcessedMetrics(nil, "jobs", tt.natsBacked)
			assert.Equal(t, tt.want, m.ClassifyAdd(tt.resourceVersion, tt.isInInitialList))
		})
	}
}

func TestProcessedMetrics_ClassifyUpdate(t *testing.T) {
	tests := []struct {
		name       string
		oldRV      string
		newRV      string
		natsBacked bool
		want       ProcessTrigger
	}{
		{name: "equal non-empty RV is relist (resync replay)", oldRV: "5", newRV: "5", natsBacked: false, want: TriggerRelist},
		{name: "equal non-empty RV is relist under nats", oldRV: "5", newRV: "5", natsBacked: true, want: TriggerRelist},
		{name: "bumped RV is live under apiserver", oldRV: "5", newRV: "6", natsBacked: false, want: TriggerLive},
		{name: "bumped RV is relist under nats", oldRV: "5", newRV: "6", natsBacked: true, want: TriggerRelist},
		{name: "minimal nats update is live", oldRV: "", newRV: "", natsBacked: true, want: TriggerLive},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewProcessedMetrics(nil, "jobs", tt.natsBacked)
			assert.Equal(t, tt.want, m.ClassifyUpdate(tt.oldRV, tt.newRV))
		})
	}
}

func TestProcessedMetrics_RecordProcessed(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := NewProcessedMetrics(reg, "jobs", false)

	m.RecordProcessed(TriggerLive)
	m.RecordProcessed(TriggerRelist)
	m.RecordProcessed(TriggerRelist)
	m.RecordProcessed(TriggerInitial)

	assert.Equal(t, 1.0, testutil.ToFloat64(m.processed.WithLabelValues("live")))
	assert.Equal(t, 2.0, testutil.ToFloat64(m.processed.WithLabelValues("relist")))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.processed.WithLabelValues("initial")))

	// An unknown source (e.g. the zero value carried by a non-classified queue
	// item) records nothing.
	m.RecordProcessed(ProcessTrigger(""))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.processed.WithLabelValues("live")))
}

func TestProcessedMetrics_NilSafe(t *testing.T) {
	var m *ProcessedMetrics
	assert.NotPanics(t, func() { m.RecordProcessed(TriggerLive) })
	assert.NotPanics(t, func() { m.ObserveDeliveryLatency(TriggerLive, 1.0) })
}

// TestProcessedMetrics_SharedAcrossResources verifies that several consumers can
// be built on one registry and that the scrape shows one metric family carrying
// a series per resource.
func TestProcessedMetrics_SharedAcrossResources(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	jobsM := NewProcessedMetrics(reg, "jobs", false)
	reposM := NewProcessedMetrics(reg, "repositories", false)

	jobsM.RecordProcessed(TriggerRelist)
	reposM.RecordProcessed(TriggerRelist)
	reposM.RecordProcessed(TriggerRelist)

	assert.Equal(t, 1.0, testutil.ToFloat64(jobsM.processed.WithLabelValues("relist")))
	assert.Equal(t, 2.0, testutil.ToFloat64(reposM.processed.WithLabelValues("relist")))

	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(`
# HELP grafana_provisioning_events_processed_total Processing started for a work-queue key, by resource and source (live = a live event; relist = the periodic re-list; initial = the informer's initial list).
# TYPE grafana_provisioning_events_processed_total counter
grafana_provisioning_events_processed_total{resource="jobs",source="relist"} 1
grafana_provisioning_events_processed_total{resource="repositories",source="relist"} 2
`), "grafana_provisioning_events_processed_total"))
}

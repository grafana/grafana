package controller

import (
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// gaugeValueByName reads the single-sample gauge `name` from the gatherer.
func gaugeValueByName(t *testing.T, g prometheus.Gatherer, name string) float64 {
	t.Helper()
	mfs, err := g.Gather()
	require.NoError(t, err)
	for _, mf := range mfs {
		if mf.GetName() == name {
			require.Len(t, mf.GetMetric(), 1)
			return mf.GetMetric()[0].GetGauge().GetValue()
		}
	}
	t.Fatalf("metric %q not found", name)
	return 0
}

// TestRepositoryController_WorkerQueueSizeGauge verifies the worker-queue-size gauge
// reports the live depth of the replica's local work queue at scrape time.
func TestRepositoryController_WorkerQueueSizeGauge(t *testing.T) {
	const metricName = "grafana_provisioning_repository_worker_queue_size"

	reg := prometheus.NewRegistry()
	rc := NewRepositoryController(
		nil, nil, nil, nil, nil, nil, nil, nil, nil,
		reg,
		nil,
		1,
		time.Minute, time.Minute, 30*time.Second,
		nil, nil,
		repository.IncrementalSyncPolicy{},
		30*time.Second,
		false,
	)

	require.Equal(t, 0.0, gaugeValueByName(t, reg, metricName))

	rc.queue.Add("ns/repo-a")
	rc.queue.Add("ns/repo-b")
	require.Equal(t, 2.0, gaugeValueByName(t, reg, metricName))

	// Get removes the key from the queue (Len drops); Done clears it from processing.
	key, _ := rc.queue.Get()
	rc.queue.Done(key)
	require.Equal(t, 1.0, gaugeValueByName(t, reg, metricName))
}

// TestConnectionController_WorkerQueueSizeGauge verifies the worker-queue-size gauge
// reports the live depth of the replica's local work queue at scrape time.
func TestConnectionController_WorkerQueueSizeGauge(t *testing.T) {
	const metricName = "grafana_provisioning_connection_worker_queue_size"

	reg := prometheus.NewRegistry()
	cc := NewConnectionController(
		nil, nil, nil, nil,
		time.Minute, 30*time.Second,
		reg,
		false,
	)

	require.Equal(t, 0.0, gaugeValueByName(t, reg, metricName))

	cc.queue.Add(&connectionQueueItem{key: "ns/conn-a"})
	cc.queue.Add(&connectionQueueItem{key: "ns/conn-b"})
	require.Equal(t, 2.0, gaugeValueByName(t, reg, metricName))

	// Get removes the item from the queue (Len drops); Done clears it from processing.
	item, _ := cc.queue.Get()
	cc.queue.Done(item)
	require.Equal(t, 1.0, gaugeValueByName(t, reg, metricName))
}

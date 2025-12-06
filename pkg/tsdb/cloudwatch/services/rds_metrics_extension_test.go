package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRDSMetricsExtension_GetExtendedRDSMetrics(t *testing.T) {
	t.Run("Should return all Performance Insights and Enhanced Monitoring metrics", func(t *testing.T) {
		metrics := GetExtendedRDSMetrics()

		// Verify we have metrics from both categories
		require.NotEmpty(t, metrics, "Extended RDS metrics should not be empty")

		// Should have Performance Insights and Enhanced Monitoring metrics combined
		expectedMinCount := len(rdsPerformanceInsightsMetrics) + len(rdsEnhancedMonitoringMetrics)
		assert.Equal(t, expectedMinCount, len(metrics), "Should have all Performance Insights and Enhanced Monitoring metrics")
	})

	t.Run("Should include key Performance Insights metrics", func(t *testing.T) {
		metrics := GetExtendedRDSMetrics()

		// Check for important Performance Insights metrics
		assert.Contains(t, metrics, "DBLoad", "Should include DBLoad metric")
		assert.Contains(t, metrics, "DBLoadCPU", "Should include DBLoadCPU metric")
		assert.Contains(t, metrics, "DBLoadNonCPU", "Should include DBLoadNonCPU metric")
		assert.Contains(t, metrics, "db.wait_event.name", "Should include wait event metric")
		assert.Contains(t, metrics, "db.sql.id", "Should include SQL ID metric")
	})

	t.Run("Should include key Enhanced Monitoring metrics", func(t *testing.T) {
		metrics := GetExtendedRDSMetrics()

		// Check for important Enhanced Monitoring metrics
		assert.Contains(t, metrics, "cpuUtilization.total", "Should include CPU utilization metric")
		assert.Contains(t, metrics, "memory.total", "Should include memory total metric")
		assert.Contains(t, metrics, "memory.free", "Should include memory free metric")
		assert.Contains(t, metrics, "diskIO.readIOsPS", "Should include disk I/O metric")
		assert.Contains(t, metrics, "network.rx", "Should include network RX metric")
		assert.Contains(t, metrics, "network.tx", "Should include network TX metric")
		assert.Contains(t, metrics, "loadAverageMinute.one", "Should include load average metric")
	})

	t.Run("Should not contain duplicate metrics", func(t *testing.T) {
		metrics := GetExtendedRDSMetrics()

		// Create a map to check for duplicates
		seen := make(map[string]bool)
		for _, metric := range metrics {
			assert.False(t, seen[metric], "Metric %s should not appear twice", metric)
			seen[metric] = true
		}
	})
}

func TestRDSMetricsExtension_PerformanceInsightsMetrics(t *testing.T) {
	t.Run("Should have all Performance Insights metric categories", func(t *testing.T) {
		metrics := rdsPerformanceInsightsMetrics

		// Check that we have metrics from each category
		hasDBLoad := false
		hasWaitEvent := false
		hasSQL := false
		hasUser := false
		hasHost := false

		for _, metric := range metrics {
			if metric == "DBLoad" || metric == "DBLoadCPU" || metric == "DBLoadNonCPU" {
				hasDBLoad = true
			}
			if metric == "db.wait_event.name" || metric == "db.wait_event.type" {
				hasWaitEvent = true
			}
			if metric == "db.sql.id" || metric == "db.sql.db_id" {
				hasSQL = true
			}
			if metric == "db.user.id" || metric == "db.user.name" {
				hasUser = true
			}
			if metric == "db.host.id" || metric == "db.host.name" {
				hasHost = true
			}
		}

		assert.True(t, hasDBLoad, "Should have DB Load metrics")
		assert.True(t, hasWaitEvent, "Should have wait event metrics")
		assert.True(t, hasSQL, "Should have SQL metrics")
		assert.True(t, hasUser, "Should have user metrics")
		assert.True(t, hasHost, "Should have host metrics")
	})
}

func TestRDSMetricsExtension_EnhancedMonitoringMetrics(t *testing.T) {
	t.Run("Should have all Enhanced Monitoring metric categories", func(t *testing.T) {
		metrics := rdsEnhancedMonitoringMetrics

		// Check that we have metrics from each category
		hasCPU := false
		hasMemory := false
		hasDiskIO := false
		hasNetwork := false
		hasLoadAvg := false
		hasSwap := false
		hasFileSystem := false

		for _, metric := range metrics {
			switch {
			case len(metric) >= 14 && metric[:14] == "cpuUtilization":
				hasCPU = true
			case len(metric) >= 6 && metric[:6] == "memory":
				hasMemory = true
			case len(metric) >= 6 && metric[:6] == "diskIO":
				hasDiskIO = true
			case len(metric) >= 7 && metric[:7] == "network":
				hasNetwork = true
			case len(metric) >= 17 && metric[:17] == "loadAverageMinute":
				hasLoadAvg = true
			case len(metric) >= 4 && metric[:4] == "swap":
				hasSwap = true
			case len(metric) >= 7 && metric[:7] == "fileSys":
				hasFileSystem = true
			}
		}

		assert.True(t, hasCPU, "Should have CPU metrics")
		assert.True(t, hasMemory, "Should have memory metrics")
		assert.True(t, hasDiskIO, "Should have disk I/O metrics")
		assert.True(t, hasNetwork, "Should have network metrics")
		assert.True(t, hasLoadAvg, "Should have load average metrics")
		assert.True(t, hasSwap, "Should have swap metrics")
		assert.True(t, hasFileSystem, "Should have file system metrics")
	})
}

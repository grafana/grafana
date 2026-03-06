package validator

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// promQLPool contains realistic PromQL expressions sourced from real Grafana dashboards.
// Used by buildDashboardJSON to generate realistic benchmark fixtures.
// Queries are selected round-robin (deterministic, no randomness in benchmarks).
var promQLPool = []string{
	`up{job="api"}`,
	`rate(http_requests_total{job="api", method="GET"}[$__rate_interval])`,
	`sum(rate(container_cpu_usage_seconds_total{namespace="default"}[5m])) by (pod)`,
	`histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`,
	`node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes`,
	`process_cpu_seconds_total`,
	`sum by (instance) (irate(node_cpu_seconds_total{mode!="idle"}[$__rate_interval]))`,
	`increase(http_requests_total{status=~"5.."}[5m])`,
	`avg_over_time(probe_duration_seconds[5m])`,
	`rate(prometheus_tsdb_head_samples_appended_total[$__rate_interval])`,
	`(node_filesystem_size_bytes{fstype!~"tmpfs|overlay"} - node_filesystem_free_bytes{fstype!~"tmpfs|overlay"}) / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}`,
	`sum(rate(grpc_server_handled_total{grpc_code!="OK"}[5m])) / sum(rate(grpc_server_handled_total[5m]))`,
	`kube_pod_container_status_restarts_total`,
	`container_memory_working_set_bytes{container!=""}`,
	`kubelet_running_pods`,
	`coredns_dns_request_duration_seconds_count`,
	`etcd_server_has_leader`,
	`scheduler_e2e_scheduling_duration_seconds_count`,
	`apiserver_request_total{code=~"2.."}`,
	`workqueue_depth{name="resource_quota"}`,
}

// concreteUID is the datasource UID used for most panels (post-interpolation).
const concreteUID = "eexrapfb04hz4d"

// buildDashboardJSON creates a realistic v1 Grafana dashboard with flat panels only.
// Uses buildPanel for panel construction. For dashboards with collapsed rows, use
// buildDashboardJSONWithRows instead.
func buildDashboardJSON(panelCount, queriesPerPanel int) map[string]any {
	panels := make([]any, 0, panelCount)
	queryIndex := 0

	for p := range panelCount {
		dsUID := concreteUID
		if p%10 == 9 {
			dsUID = "$datasource"
		}
		panels = append(panels, buildPanel(p+1, dsUID, queriesPerPanel, &queryIndex))
	}

	return map[string]any{
		"annotations": map[string]any{
			"list": []any{},
		},
		"editable":      true,
		"panels":        panels,
		"schemaVersion": 39,
		"tags":          []any{"benchmark"},
		"templating": map[string]any{
			"list": []any{},
		},
		"time": map[string]any{
			"from": "now-1h",
			"to":   "now",
		},
		"title":   fmt.Sprintf("Benchmark Dashboard (%d panels)", panelCount),
		"uid":     "benchmark-uid",
		"version": 1,
	}
}

// buildPanel creates a single timeseries panel with the given queries.
// Shared by both buildDashboardJSON and buildDashboardJSONWithRows.
func buildPanel(id int, dsUID string, queriesPerPanel int, queryIndex *int) map[string]any {
	targets := make([]any, 0, queriesPerPanel)
	for q := range queriesPerPanel {
		refID := string(rune('A' + q))
		targets = append(targets, map[string]any{
			"datasource": map[string]any{
				"type": "prometheus",
				"uid":  dsUID,
			},
			"expr":         promQLPool[*queryIndex%len(promQLPool)],
			"format":       "time_series",
			"hide":         false,
			"interval":     "30s",
			"legendFormat": fmt.Sprintf("{{instance}} panel %d query %s", id, refID),
			"refId":        refID,
		})
		*queryIndex++
	}

	return map[string]any{
		"datasource": map[string]any{
			"type": "prometheus",
			"uid":  dsUID,
		},
		"fieldConfig": map[string]any{
			"defaults": map[string]any{
				"color": map[string]any{
					"mode": "palette-classic",
				},
				"custom": map[string]any{
					"drawStyle":   "line",
					"fillOpacity": 10,
					"lineWidth":   1,
				},
				"thresholds": map[string]any{
					"mode": "absolute",
					"steps": []any{
						map[string]any{"color": "green"},
						map[string]any{"color": "red", "value": 80},
					},
				},
			},
			"overrides": []any{},
		},
		"gridPos": map[string]any{
			"h": 8,
			"w": 12,
			"x": ((id - 1) % 2) * 12,
			"y": ((id - 1) / 2) * 8,
		},
		"id":            id,
		"options":       map[string]any{},
		"pluginVersion": "10.0.0",
		"targets":       targets,
		"title":         fmt.Sprintf("Panel %d", id),
		"type":          "timeseries",
	}
}

// buildDashboardJSONWithRows creates a dashboard that mixes flat panels and collapsed rows
// with nested panels, mirroring the structure of real dashboards like Node Exporter Full
// (grafana.com/dashboards/1860). In that dashboard, ~77% of panels are inside collapsed rows.
//
// Parameters:
//   - flatPanels: number of top-level panels (not inside rows)
//   - rows: number of collapsed row panels
//   - panelsPerRow: number of nested panels inside each row
//   - queriesPerPanel: queries per panel (both flat and nested)
func buildDashboardJSONWithRows(flatPanels, rows, panelsPerRow, queriesPerPanel int) map[string]any {
	panels := make([]any, 0, flatPanels+rows)
	queryIndex := 0
	panelID := 1

	// Flat panels (not inside rows)
	for range flatPanels {
		dsUID := concreteUID
		if panelID%10 == 0 {
			dsUID = "$datasource"
		}
		panels = append(panels, buildPanel(panelID, dsUID, queriesPerPanel, &queryIndex))
		panelID++
	}

	// Collapsed rows with nested panels
	for r := range rows {
		nested := make([]any, 0, panelsPerRow)
		for range panelsPerRow {
			dsUID := concreteUID
			if panelID%10 == 0 {
				dsUID = "$datasource"
			}
			nested = append(nested, buildPanel(panelID, dsUID, queriesPerPanel, &queryIndex))
			panelID++
		}

		row := map[string]any{
			"type":      "row",
			"title":     fmt.Sprintf("Row %d", r+1),
			"collapsed": true,
			"panels":    nested,
			"id":        panelID,
			"gridPos":   map[string]any{"h": 1, "w": 24, "x": 0, "y": 0},
		}
		panels = append(panels, row)
		panelID++
	}

	totalPanels := flatPanels + rows*panelsPerRow
	return map[string]any{
		"annotations": map[string]any{
			"list": []any{},
		},
		"editable":      true,
		"panels":        panels,
		"schemaVersion": 39,
		"tags":          []any{"benchmark"},
		"templating": map[string]any{
			"list": []any{},
		},
		"time": map[string]any{
			"from": "now-1h",
			"to":   "now",
		},
		"title":   fmt.Sprintf("Benchmark Dashboard (%d panels, %d rows)", totalPanels, rows),
		"uid":     "benchmark-rows-uid",
		"version": 1,
	}
}

// TestPerformanceBaseline_ExtractQueries asserts that query extraction for a large
// dashboard completes within a generous threshold. Uses 5ms to account for slow CI
// machines, GC pauses, and noisy neighbors. Our benchmarks show ~94µs for 800 queries
// on fast hardware — this test only catches catastrophic regressions (e.g., O(n²)).
// For precise measurements, use the benchmarks with `go test -bench=`.
func TestPerformanceBaseline_ExtractQueries(t *testing.T) {
	dashboard := buildDashboardJSON(200, 4)

	start := time.Now()
	queries, err := extractQueriesFromDashboard(dashboard)
	elapsed := time.Since(start)

	assert.NoError(t, err)
	assert.Len(t, queries, 800)
	assert.Less(t, elapsed, 5*time.Millisecond,
		"extractQueriesFromDashboard took %v, expected < 5ms", elapsed)
}

// TestPerformanceBaseline_GroupQueries asserts that query grouping completes within
// a generous threshold. Same rationale as TestPerformanceBaseline_ExtractQueries.
func TestPerformanceBaseline_GroupQueries(t *testing.T) {
	dashboard := buildDashboardJSON(100, 4)
	queries, err := extractQueriesFromDashboard(dashboard)
	assert.NoError(t, err)

	start := time.Now()
	grouped := groupQueriesByDatasource(queries, concreteUID, dashboard)
	elapsed := time.Since(start)

	assert.NotEmpty(t, grouped)
	assert.Less(t, elapsed, 5*time.Millisecond,
		"groupQueriesByDatasource took %v, expected < 5ms", elapsed)
}

// BenchmarkGroupQueriesByDatasource measures the second pipeline stage:
// grouping extracted queries by datasource UID with template variable resolution.
func BenchmarkGroupQueriesByDatasource(b *testing.B) {
	cases := []struct {
		panels          int
		queriesPerPanel int
	}{
		{10, 1},
		{50, 2},
		{100, 2},
		{100, 4},
	}

	for _, tc := range cases {
		dashboard := buildDashboardJSON(tc.panels, tc.queriesPerPanel)
		name := fmt.Sprintf("panels=%d/qpp=%d", tc.panels, tc.queriesPerPanel)
		// extract queries first
		queries, _ := extractQueriesFromDashboard(dashboard)
		b.Run(name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				_ = groupQueriesByDatasource(queries, concreteUID, dashboard)
			}
		})
	}
}

// BenchmarkExtractQueriesFromDashboard measures how long it takes to extract
// queries from dashboards of various sizes. This is the first stage of the
// /check pipeline: JSON parsing → query extraction.
// Includes both flat and row-based (nested) dashboard layouts.
func BenchmarkExtractQueriesFromDashboard(b *testing.B) {
	// Flat dashboard cases
	flatCases := []struct {
		panels          int
		queriesPerPanel int
	}{
		{10, 1},
		{50, 2},
		{100, 2},
		{100, 4},
	}

	for _, tc := range flatCases {
		dashboard := buildDashboardJSON(tc.panels, tc.queriesPerPanel)
		name := fmt.Sprintf("flat/panels=%d/qpp=%d", tc.panels, tc.queriesPerPanel)

		b.Run(name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				_, _ = extractQueriesFromDashboard(dashboard)
			}
		})
	}

	// Row-based dashboard cases (collapsed rows with nested panels)
	// Modeled after Node Exporter Full (1860): ~20% flat, ~80% in collapsed rows
	rowCases := []struct {
		flatPanels      int
		rows            int
		panelsPerRow    int
		queriesPerPanel int
	}{
		{5, 5, 5, 2},    // Small: 30 panels, 60 queries
		{15, 14, 8, 2},  // Node Exporter-like: 127 panels, 254 queries
		{20, 20, 10, 3}, // Large: 220 panels, 660 queries
	}

	for _, tc := range rowCases {
		dashboard := buildDashboardJSONWithRows(tc.flatPanels, tc.rows, tc.panelsPerRow, tc.queriesPerPanel)
		totalPanels := tc.flatPanels + tc.rows*tc.panelsPerRow
		name := fmt.Sprintf("rows/panels=%d/rows=%d/qpp=%d", totalPanels, tc.rows, tc.queriesPerPanel)

		b.Run(name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				_, _ = extractQueriesFromDashboard(dashboard)
			}
		})
	}
}

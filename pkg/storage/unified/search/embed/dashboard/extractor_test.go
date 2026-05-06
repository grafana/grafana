package dashboard

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestExtractor_Resource(t *testing.T) {
	require.Equal(t, "dashboards", New().Resource())
}

func TestExtractor_Classic(t *testing.T) {
	// Classic v1 dashboard with two panels and one row marker. The shared
	// parser doesn't associate flat-row panels with their row marker, so
	// we don't expect "Errors → 5xx rate" here — the row name only
	// surfaces for collapsed rows (next test).
	body := map[string]any{
		"uid":         "dash-uid-1",
		"title":       "API Latency",
		"description": "Production API latency dashboard",
		"tags":        []any{"production", "latency"},
		"panels": []any{
			map[string]any{
				"id":          1,
				"title":       "p99 latency",
				"description": "99th percentile across all routes",
				"datasource":  map[string]any{"uid": "prom-1", "type": "prometheus"},
				"targets": []any{
					map[string]any{
						"refId":      "A",
						"datasource": map[string]any{"uid": "prom-1", "type": "prometheus"},
						"expr":       `histogram_quantile(0.99, sum(rate(http_duration_seconds_bucket[5m])) by (le))`,
					},
				},
			},
			map[string]any{
				"id":    2,
				"title": "5xx rate",
				"datasource": map[string]any{
					"uid": "prom-1", "type": "prometheus",
				},
				"targets": []any{
					map[string]any{
						"expr": `sum(rate(http_requests_total{status=~"5.."}[5m]))`,
					},
				},
			},
		},
		"metadata": map[string]any{
			"annotations": map[string]any{
				"grafana.app/folder": "folder-prod",
			},
		},
	}
	value, _ := json.Marshal(body)

	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Resource: "dashboards", Name: "dash-uid-1"}, value, "Production")
	require.NoError(t, err)
	require.Len(t, items, 2)

	assert.Equal(t, "dash-uid-1", items[0].UID)
	assert.Equal(t, "API Latency — p99 latency", items[0].Title)
	assert.Equal(t, "panel/1", items[0].Subresource)
	assert.Equal(t, "folder-prod", items[0].Folder)
	assert.Contains(t, items[0].Content, "Production → API Latency → p99 latency")
	assert.Contains(t, items[0].Content, "histogram_quantile")
	assert.Contains(t, items[0].Content, "Tags: production, latency")

	assert.Equal(t, "panel/2", items[1].Subresource)
	assert.Contains(t, items[1].Content, `sum(rate(http_requests_total{status=~"5.."}[5m]))`)

	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	assert.Equal(t, "API Latency", md["dashboardTitle"])
	assert.Equal(t, []any{float64(1)}, md["panelIds"])
	assert.Equal(t, "Production", md["folderTitle"])
	assert.Equal(t, "prom-1", md["datasourceUid"])
	assert.Equal(t, "promql", md["language"])
}

func TestExtractor_CollapsedRow(t *testing.T) {
	// A row with collapsed panels — the shared parser captures this in
	// PanelSummaryInfo.Collapsed and we surface it as the row name.
	body := map[string]any{
		"uid":   "dash-collapsed",
		"title": "Collapsed Dashboard",
		"panels": []any{
			map[string]any{
				"id":    99,
				"type":  "row",
				"title": "Errors",
				"panels": []any{
					map[string]any{
						"id":      5,
						"title":   "Inside the row",
						"targets": []any{map[string]any{"expr": "up"}},
					},
				},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "dash-collapsed"}, value, "")
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "panel/5", items[0].Subresource)
	assert.Contains(t, items[0].Content, "Errors → Inside the row")

	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	assert.Equal(t, "Errors", md["rowName"])
}

func TestExtractor_V2_Structural(t *testing.T) {
	// V2 (k8s-shape) dashboards: panel IDs, datasource refs, and query
	// expressions are all extracted.
	body := map[string]any{
		"apiVersion": "dashboard.grafana.app/v2beta1",
		"metadata": map[string]any{
			"name": "v2-dash",
			"annotations": map[string]any{
				"grafana.app/folder": "folder-eng",
			},
		},
		"spec": map[string]any{
			"title": "Service Health",
			"tags":  []any{"v2"},
			"elements": map[string]any{
				"panel-a": map[string]any{
					"kind": "Panel",
					"spec": map[string]any{
						"id":          1,
						"title":       "Request rate",
						"description": "Per-route request rate",
						"vizConfig":   map[string]any{"kind": "TimeseriesPanel", "spec": map[string]any{}},
						"data": map[string]any{
							"kind": "QueryGroup",
							"spec": map[string]any{
								"queries": []any{
									map[string]any{
										"kind": "PanelQuery",
										"spec": map[string]any{
											"refId": "A",
											"query": map[string]any{
												"kind":       "PrometheusQuery",
												"group":      "prometheus",
												"datasource": map[string]any{"name": "prom-2"},
												"spec": map[string]any{
													"expr": `sum(rate(http_requests_total[5m]))`,
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "v2-dash"}, value, "Engineering")
	require.NoError(t, err)
	require.Len(t, items, 1)

	assert.Equal(t, "v2-dash", items[0].UID)
	assert.Equal(t, "Service Health — Request rate", items[0].Title)
	assert.Equal(t, "panel/1", items[0].Subresource)
	assert.Equal(t, "folder-eng", items[0].Folder)
	assert.Contains(t, items[0].Content, "Engineering → Service Health → Request rate")
	assert.Contains(t, items[0].Content, "Per-route request rate")
	assert.Contains(t, items[0].Content, "Tags: v2")
	assert.Contains(t, items[0].Content, "sum(rate(http_requests_total[5m]))")

	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	assert.Equal(t, "prom-2", md["datasourceUid"])
	assert.Equal(t, "promql", md["language"])
}

func TestExtractor_V2_RowLayout(t *testing.T) {
	// V2 rows are described separately from elements: spec.layout.spec.rows[]
	// contains items that point back to element keys via spec.element.name.
	body := map[string]any{
		"apiVersion": "dashboard.grafana.app/v2beta1",
		"metadata": map[string]any{
			"name": "v2-rows",
		},
		"spec": map[string]any{
			"title": "Grouped",
			"elements": map[string]any{
				"panel-a": map[string]any{
					"kind": "Panel",
					"spec": map[string]any{
						"id":    7,
						"title": "Inside row",
					},
				},
			},
			"layout": map[string]any{
				"kind": "RowsLayout",
				"spec": map[string]any{
					"rows": []any{
						map[string]any{
							"kind": "RowsLayoutRow",
							"spec": map[string]any{
								"title": "Latency",
								"layout": map[string]any{
									"spec": map[string]any{
										"items": []any{
											map[string]any{
												"spec": map[string]any{
													"element": map[string]any{"name": "panel-a"},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "v2-rows"}, value, "")
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Contains(t, items[0].Content, "Grouped → Latency → Inside row")

	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	assert.Equal(t, "Latency", md["rowName"])
}

func TestExtractor_DashboardWithoutPanels(t *testing.T) {
	body := map[string]any{
		"uid":   "empty",
		"title": "Empty",
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "empty"}, value, "")
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestExtractor_MissingUIDFallsBackToKeyName(t *testing.T) {
	body := map[string]any{
		"title": "Untitled",
		"panels": []any{
			map[string]any{
				"id":      1,
				"title":   "Panel",
				"targets": []any{map[string]any{"expr": "up"}},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "from-key"}, value, "")
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "from-key", items[0].UID)
}

func TestExtractor_SQLQueries(t *testing.T) {
	body := map[string]any{
		"uid":   "sql-dash",
		"title": "Reports",
		"panels": []any{
			map[string]any{
				"id":         1,
				"title":      "Daily revenue",
				"datasource": map[string]any{"uid": "pg-1", "type": "postgres"},
				"targets": []any{
					map[string]any{
						"refId":  "A",
						"rawSql": "SELECT date, SUM(amount) FROM orders GROUP BY date",
					},
				},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "sql-dash"}, value, "")
	require.NoError(t, err)
	require.Len(t, items, 1)
	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	assert.Equal(t, "sql", md["language"])
	assert.Contains(t, items[0].Content, "SELECT date, SUM(amount) FROM orders")
}

func TestExtractor_InvalidJSON(t *testing.T) {
	_, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "bad"}, []byte(`{not json`), "")
	require.Error(t, err)
}

func TestExtractorV2Dash(t *testing.T) {
	value, err := os.ReadFile("testdata/v2dash.json")
	require.NoError(t, err)

	items, extractErr := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Resource: "dashboards", Name: "ow8csz6"}, value, "")
	require.NoError(t, extractErr)
	require.Len(t, items, 2)

	for i, it := range items {
		t.Logf("--- item %d ---", i)
		t.Logf("  UID         = %q", it.UID)
		t.Logf("  Title       = %q", it.Title)
		t.Logf("  Subresource = %q", it.Subresource)
		t.Logf("  Folder      = %q", it.Folder)
		t.Logf("  Content     = %q", it.Content)
		t.Logf("  Metadata    = %s", string(it.Metadata))
	}

	// Panel 1: instance info
	assert.Equal(t, "ow8csz6", items[0].UID)
	assert.Equal(t, "New dashboard — instance info", items[0].Title)
	assert.Equal(t, "panel/1", items[0].Subresource)
	assert.Equal(t, "", items[0].Folder)
	assert.Equal(t, "New dashboard → instance info\ngrafanacloud_instance_info", items[0].Content)

	var md0 map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md0))
	assert.Equal(t, "New dashboard", md0["dashboardTitle"])
	assert.Equal(t, []any{float64(1)}, md0["panelIds"])
	assert.Equal(t, "grafanacloud-usage", md0["datasourceUid"])
	assert.Equal(t, "promql", md0["language"])
	assert.Nil(t, md0["folderTitle"])
	assert.Nil(t, md0["rowName"])

	// Panel 2: dashboard counts
	assert.Equal(t, "New dashboard — dashboard counts", items[1].Title)
	assert.Equal(t, "panel/2", items[1].Subresource)
	assert.Equal(t, "New dashboard → dashboard counts\ngrafanacloud_grafana_instance_dashboard_count", items[1].Content)

	var md1 map[string]any
	require.NoError(t, json.Unmarshal(items[1].Metadata, &md1))
	assert.Equal(t, []any{float64(2)}, md1["panelIds"])
	assert.Equal(t, "grafanacloud-usage", md1["datasourceUid"])
	assert.Equal(t, "promql", md1["language"])
}

func TestExtractorV1Dash(t *testing.T) {
	value, err := os.ReadFile("testdata/v1dash.json")
	require.NoError(t, err)

	items, extractErr := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Resource: "dashboards", Name: "p_YnyR34k"},
		value, "")
	require.NoError(t, extractErr)
	require.Len(t, items, 1)

	it := items[0]
	t.Logf("UID         = %q", it.UID)
	t.Logf("Title       = %q", it.Title)
	t.Logf("Subresource = %q", it.Subresource)
	t.Logf("Folder      = %q", it.Folder)
	t.Logf("Content     = %q", it.Content)
	t.Logf("Metadata    = %s", string(it.Metadata))

	assert.Equal(t, "p_YnyR34k", it.UID)
	assert.Equal(t, "Energy — Power Consumption Details", it.Title)
	assert.Equal(t, "panel/2", it.Subresource)
	assert.Equal(t, "", it.Folder)

	// Breadcrumb (no folder, no row), then tags, then all three queries
	// numbered.
	assert.Contains(t, it.Content, "Energy → Power Consumption Details")
	assert.Contains(t, it.Content, "Tags: dogs, cats")
	assert.Contains(t, it.Content, "Query 1: abs(hass_sensor_power_w{friendly_name=~\".*Minute Average\"")
	assert.Contains(t, it.Content, "Query 2:")
	assert.Contains(t, it.Content, "Query 3: hass_sensor_power_w{friendly_name=\"Solar Power Minute Average\"} / 1000")

	var md map[string]any
	require.NoError(t, json.Unmarshal(it.Metadata, &md))
	assert.Equal(t, "Energy", md["dashboardTitle"])
	assert.Equal(t, []any{float64(2)}, md["panelIds"])
	assert.Equal(t, "grafanacloud-prom", md["datasourceUid"])
	assert.Equal(t, "promql", md["language"])
	assert.Nil(t, md["folderTitle"])
	assert.Nil(t, md["rowName"])
}

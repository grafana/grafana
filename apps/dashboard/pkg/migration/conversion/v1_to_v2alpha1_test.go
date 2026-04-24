package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

// TestV1ToV2alpha1 tests conversion from v1 to v2alpha1 with various datasource scenarios
func TestV1ToV2alpha1(t *testing.T) {
	// Initialize the migrator with test providers
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	testCases := []struct {
		name             string
		createV1         func() *dashv1.Dashboard
		validateV2alpha1 func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard)
	}{
		{
			name: "panel type datasource with no UID - use panel ref (query empty), resolve to grafana UID",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									// Panel datasource has type: "datasource" but no UID
									"datasource": map[string]interface{}{
										"type": "datasource",
										// No "uid" field
									},
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
											// Target datasource is empty object {}
											"datasource": map[string]interface{}{},
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				// Verify queries have datasource with UID resolved to "grafana"
				require.Len(t, panel.Spec.Data.Spec.Queries, 1)
				query := panel.Spec.Data.Spec.Queries[0]
				require.NotNil(t, query.Spec.Datasource, "Query should have datasource")

				// Verify datasource type is "datasource"
				assert.NotNil(t, query.Spec.Datasource.Type)
				assert.Equal(t, "datasource", *query.Spec.Datasource.Type)

				// Verify datasource UID is resolved to "grafana"
				assert.NotNil(t, query.Spec.Datasource.Uid)
				assert.Equal(t, dashboard.GrafanaDatasourceUID, *query.Spec.Datasource.Uid, "type: 'datasource' with no UID should resolve to uid: 'grafana'")

				// Verify query kind matches datasource type
				assert.Equal(t, "datasource", query.Spec.Query.Kind)
			},
		},
		{
			name: "targets with empty datasource {} - use panel ref (query has no ref), get panel DS",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									"datasource": map[string]interface{}{
										"type": "prometheus",
										"uid":  "prometheus-uid",
									},
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{},
										},
										map[string]interface{}{
											"refId":      "B",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{},
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				// Query has no ref (empty {}) → use panel ref; both queries get panel DS
				require.Len(t, panel.Spec.Data.Spec.Queries, 2)
				for _, query := range panel.Spec.Data.Spec.Queries {
					require.NotNil(t, query.Spec.Datasource)
					assert.Equal(t, "prometheus", *query.Spec.Datasource.Type)
					assert.Equal(t, "prometheus-uid", *query.Spec.Datasource.Uid)
					assert.Equal(t, "prometheus", query.Spec.Query.Kind)
				}
			},
		},
		{
			// query ref != panel ref and panel is not mixed and query is not expression.
			name: "panel ref used when query ref differs from panel ref (panel not mixed, query not expression)",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									"datasource": map[string]interface{}{
										"type": "prometheus",
										"uid":  "prometheus-uid",
									},
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{
												"type": "loki",
												"uid":  "loki-uid",
											},
										},
										map[string]interface{}{
											"refId":      "B",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{
												"type": "elasticsearch",
												"uid":  "elasticsearch-uid",
											},
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				// Query ref != panel ref and panel not mixed → use panel ref (matches frontend)
				require.Len(t, panel.Spec.Data.Spec.Queries, 2)
				for _, query := range panel.Spec.Data.Spec.Queries {
					require.NotNil(t, query.Spec.Datasource)
					assert.Equal(t, "prometheus", *query.Spec.Datasource.Type)
					assert.Equal(t, "prometheus-uid", *query.Spec.Datasource.Uid)
					assert.Equal(t, "prometheus", query.Spec.Query.Kind)
				}
			},
		},
		{
			// Mixed is identified by panel uid "-- Mixed --". When panel is mixed we do not use panel ref.
			name: "mixed panel (uid -- Mixed --) - each query keeps its target datasource",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									"datasource": map[string]interface{}{
										"type": "datasource",
										"uid":  "-- Mixed --",
									},
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{
												"type": "prometheus",
												"uid":  "prometheus-uid",
											},
										},
										map[string]interface{}{
											"refId":      "B",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{
												"type": "loki",
												"uid":  "loki-uid",
											},
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				require.Len(t, panel.Spec.Data.Spec.Queries, 2)
				// Query A: prometheus
				assert.Equal(t, "prometheus", *panel.Spec.Data.Spec.Queries[0].Spec.Datasource.Type)
				assert.Equal(t, "prometheus-uid", *panel.Spec.Data.Spec.Queries[0].Spec.Datasource.Uid)
				// Query B: loki
				assert.Equal(t, "loki", *panel.Spec.Data.Spec.Queries[1].Spec.Datasource.Type)
				assert.Equal(t, "loki-uid", *panel.Spec.Data.Spec.Queries[1].Spec.Datasource.Uid)
			},
		},
		{
			// Expression queries (__expr__) are never overwritten by panel ref (same as frontend).
			name: "expression query (__expr__) keeps expression ref when panel has different datasource",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									"datasource": map[string]interface{}{
										"type": "prometheus",
										"uid":  "prometheus-uid",
									},
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{},
										},
										map[string]interface{}{
											"refId":      "B",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{
												"type": "__expr__",
												"uid":  "__expr__",
											},
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				require.Len(t, panel.Spec.Data.Spec.Queries, 2)
				// Query A: no ref → uses panel
				require.NotNil(t, panel.Spec.Data.Spec.Queries[0].Spec.Datasource)
				assert.Equal(t, "prometheus", *panel.Spec.Data.Spec.Queries[0].Spec.Datasource.Type)
				assert.Equal(t, "prometheus-uid", *panel.Spec.Data.Spec.Queries[0].Spec.Datasource.Uid)
				// Query B: expression → not overwritten by panel
				require.NotNil(t, panel.Spec.Data.Spec.Queries[1].Spec.Datasource)
				assert.Equal(t, "__expr__", *panel.Spec.Data.Spec.Queries[1].Spec.Datasource.Type)
				assert.Equal(t, "__expr__", *panel.Spec.Data.Spec.Queries[1].Spec.Datasource.Uid)
				assert.Equal(t, "__expr__", panel.Spec.Data.Spec.Queries[1].Spec.Query.Kind)
			},
		},
		{
			name: "expression query with template variable UID keeps expression ref when panel has different datasource",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "timeseries",
									"datasource": map[string]interface{}{
										"type": "prometheus",
										"uid":  "${ds}",
									},
									"targets": []interface{}{
										map[string]interface{}{
											"refId": "failed_all",
											"datasource": map[string]interface{}{
												"type": "prometheus",
												"uid":  "${ds}",
											},
											"expr": "sum(failed_metric)",
										},
										map[string]interface{}{
											"refId": "Failure rate",
											"datasource": map[string]interface{}{
												"type": "__expr__",
												"uid":  "${DS_EXPRESSION}",
											},
											"expression": "$failed_all / $all * 100",
											"type":       "math",
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				require.Len(t, panel.Spec.Data.Spec.Queries, 2)
				// Query A: prometheus → uses panel ref
				require.NotNil(t, panel.Spec.Data.Spec.Queries[0].Spec.Datasource)
				assert.Equal(t, "prometheus", *panel.Spec.Data.Spec.Queries[0].Spec.Datasource.Type)
				assert.Equal(t, "${ds}", *panel.Spec.Data.Spec.Queries[0].Spec.Datasource.Uid)
				// Query B: expression with template variable UID → not overwritten by panel
				require.NotNil(t, panel.Spec.Data.Spec.Queries[1].Spec.Datasource)
				assert.Equal(t, "__expr__", *panel.Spec.Data.Spec.Queries[1].Spec.Datasource.Type)
				assert.Equal(t, "${DS_EXPRESSION}", *panel.Spec.Data.Spec.Queries[1].Spec.Datasource.Uid)
				assert.Equal(t, "__expr__", panel.Spec.Data.Spec.Queries[1].Spec.Query.Kind)
			},
		},
		{
			name: "panel datasource null and target has no datasource field - no default set",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									// Panel datasource is null
									"datasource": nil,
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
											// Target has no datasource field at all (not even empty object)
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				// usePanelRef true (query empty) but hasPanelRef false (panel null) → query keeps no ref
				require.Len(t, panel.Spec.Data.Spec.Queries, 1)
				query := panel.Spec.Data.Spec.Queries[0]
				assert.Nil(t, query.Spec.Datasource)
			},
		},
		{
			name: "empty panel and target datasource {} - preserved as empty (no panel ref to apply)",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									// Panel datasource is empty object {} - should be preserved as empty
									"datasource": map[string]interface{}{},
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
											"datasource": map[string]interface{}{},
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				// usePanelRef true (query empty) but hasPanelRef false (panel {} → nil panelDatasource) → query stays empty
				require.Len(t, panel.Spec.Data.Spec.Queries, 1)
				query := panel.Spec.Data.Spec.Queries[0]
				assert.Nil(t, query.Spec.Datasource)
				assert.Equal(t, "", query.Spec.Query.Kind)
			},
		},
		{
			name: "missing refIds are assigned while existing refIds are preserved",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "",
											"scenarioId": "random_walk",
										},
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
										},
										map[string]interface{}{
											"refId":      "",
											"scenarioId": "random_walk",
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)

				require.Len(t, panel.Spec.Data.Spec.Queries, 3)
				assert.Equal(t, "B", panel.Spec.Data.Spec.Queries[0].Spec.RefId)
				assert.Equal(t, "A", panel.Spec.Data.Spec.Queries[1].Spec.RefId)
				assert.Equal(t, "C", panel.Spec.Data.Spec.Queries[2].Spec.RefId)
			},
		},
		{
			name: "panels without IDs should not overwrite each other",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title":         "Test Dashboard Without Panel IDs",
							"schemaVersion": float64(42),
							"panels": []interface{}{
								map[string]interface{}{
									// No "id" field - should get unique element name
									"type":  "stat",
									"title": "Panel 1 - No ID",
									"gridPos": map[string]interface{}{
										"h": float64(4), "w": float64(6), "x": float64(0), "y": float64(0),
									},
									"targets": []interface{}{
										map[string]interface{}{"refId": "A"},
									},
								},
								map[string]interface{}{
									// No "id" field - should get unique element name
									"type":  "stat",
									"title": "Panel 2 - No ID",
									"gridPos": map[string]interface{}{
										"h": float64(4), "w": float64(6), "x": float64(6), "y": float64(0),
									},
									"targets": []interface{}{
										map[string]interface{}{"refId": "A"},
									},
								},
								map[string]interface{}{
									// No "id" field - should get unique element name
									"type":  "timeseries",
									"title": "Panel 3 - No ID",
									"gridPos": map[string]interface{}{
										"h": float64(8), "w": float64(12), "x": float64(0), "y": float64(4),
									},
									"targets": []interface{}{
										map[string]interface{}{"refId": "A"},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				// All 3 panels should be preserved, not overwritten
				assert.Len(t, v2alpha1.Spec.Elements, 3, "All 3 panels should be preserved, but some were lost due to ID collision")

				// Verify we have 3 unique panels with their queries
				totalQueries := 0
				for _, element := range v2alpha1.Spec.Elements {
					if element.PanelKind != nil {
						totalQueries += len(element.PanelKind.Spec.Data.Spec.Queries)
					}
				}
				assert.Equal(t, 3, totalQueries, "all 3 queries should be preserved")
			},
		},
		{
			name: "dashboard with matcher config conversion (transformation filter and field override)",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":    1,
									"type":  "timeseries",
									"title": "Panel with matchers",
									"gridPos": map[string]interface{}{
										"h": 8, "w": 12, "x": 0, "y": 0,
									},
									"transformations": []interface{}{
										map[string]interface{}{
											"id":      "filterByValue",
											"options": map[string]interface{}{},
											// no filter - exercises nil path
										},
										map[string]interface{}{
											"id": "groupBy",
											"filter": map[string]interface{}{
												"id":      "byName",
												"scope":   "series",
												"options": map[string]interface{}{"include": ".*"},
											},
											"options": map[string]interface{}{"include": ".*"},
										},
									},
									"fieldConfig": map[string]interface{}{
										"overrides": []interface{}{
											map[string]interface{}{
												"matcher": map[string]interface{}{
													"id":      "byName",
													"scope":   "nested",
													"options": map[string]interface{}{"name": "Field1"},
												},
												"properties": []interface{}{},
											},
										},
									},
									"targets": []interface{}{},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.Contains(t, v2alpha1.Spec.Elements, "panel-1")
				el := v2alpha1.Spec.Elements["panel-1"]
				require.NotNil(t, el.PanelKind, "PanelKind should not be nil")

				// Transformation with no filter: Filter should be nil
				transformations := el.PanelKind.Spec.Data.Spec.Transformations
				require.Len(t, transformations, 2)
				assert.Nil(t, transformations[0].Spec.Filter, "first transformation Filter should be nil")

				// Transformation with filter (scope series): converted Filter should match
				require.NotNil(t, transformations[1].Spec.Filter, "second transformation Filter should not be nil")
				assert.Equal(t, "groupBy", transformations[1].Kind)
				assert.Equal(t, "byName", transformations[1].Spec.Filter.Id)
				require.NotNil(t, transformations[1].Spec.Filter.Scope)
				assert.Equal(t, dashv2alpha1.DashboardMatcherScopeSeries, *transformations[1].Spec.Filter.Scope)
				assert.Equal(t, map[string]interface{}{"include": ".*"}, transformations[1].Spec.Filter.Options)

				// Field config override Matcher (scope nested)
				fc := el.PanelKind.Spec.VizConfig.Spec.FieldConfig
				require.Len(t, fc.Overrides, 1)
				overrideMatcher := fc.Overrides[0].Matcher
				assert.Equal(t, "byName", overrideMatcher.Id)
				require.NotNil(t, overrideMatcher.Scope)
				assert.Equal(t, dashv2alpha1.DashboardMatcherScopeNested, *overrideMatcher.Scope)
				assert.Equal(t, map[string]interface{}{"name": "Field1"}, overrideMatcher.Options)
			},
		},
		{
			name: "legacy bare-string panel datasource is preserved as a ref (not dropped) when unknown to the index",
			createV1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":         103,
									"type":       "timeseries",
									"datasource": "TEST_DB",
									"targets": []interface{}{
										map[string]interface{}{
											"refId": "A",
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.Contains(t, v2alpha1.Spec.Elements, "panel-103")
				panel := v2alpha1.Spec.Elements["panel-103"].PanelKind
				require.NotNil(t, panel)

				require.Len(t, panel.Spec.Data.Spec.Queries, 1)
				query := panel.Spec.Data.Spec.Queries[0]
				require.NotNil(t, query.Spec.Datasource, "bare-string panel datasource should be preserved as a ref, not dropped")

				require.NotNil(t, query.Spec.Datasource.Uid)
				require.NotNil(t, query.Spec.Datasource.Type)
				assert.Equal(t, "TEST_DB", *query.Spec.Datasource.Uid,
					"unknown legacy string datasource should be preserved as the UID")
				assert.Equal(t, "", *query.Spec.Datasource.Type,
					"unknown legacy string datasource should have empty type (no index match)")
			},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			v1Dash := tt.createV1()

			// Convert to v2alpha1
			var v2alpha1Dash dashv2alpha1.Dashboard
			err := scheme.Convert(v1Dash, &v2alpha1Dash, nil)
			require.NoError(t, err)

			// Validate the conversion result
			tt.validateV2alpha1(t, &v2alpha1Dash)
		})
	}
}

// TestV1ToV2alpha1_TimezoneEmptyString verifies that timezone: "" from V1 is left unset in V2
// so that the user-profile-preference fallback continues to work.
func TestV1ToV2alpha1_TimezoneEmptyString(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	v1Dash := &dashv1.Dashboard{
		Spec: dashv1.DashboardSpec{
			Object: map[string]interface{}{
				"title":    "Test Dashboard",
				"timezone": "",
			},
		},
	}

	var v2alpha1Dash dashv2alpha1.Dashboard
	err = scheme.Convert(v1Dash, &v2alpha1Dash, nil)
	require.NoError(t, err)

	// timezone: "" in V1 means "use user preference". In V2 this is represented by
	// leaving Timezone unset (nil), so the serving layer can apply the fallback.
	assert.Nil(t, v2alpha1Dash.Spec.TimeSettings.Timezone,
		"timezone: '' from V1 should produce nil Timezone in V2, not 'browser'")
}

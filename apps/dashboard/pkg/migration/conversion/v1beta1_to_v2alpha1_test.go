package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

// TestV1beta1ToV2alpha1 tests conversion from v1beta1 to v2alpha1 with various datasource scenarios
func TestV1beta1ToV2alpha1(t *testing.T) {
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
		createV1beta1    func() *dashv1.Dashboard
		validateV2alpha1 func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard)
	}{
		{
			name: "panel type datasource with no UID - use panel ref (query empty), resolve to grafana UID",
			createV1beta1: func() *dashv1.Dashboard {
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
			createV1beta1: func() *dashv1.Dashboard {
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
			// Same condition as frontend (SceneQueryRunner): use panel when query has no ref, or when
			// query ref != panel ref and panel is not mixed and query is not expression.
			name: "panel ref used when query ref differs from panel ref (panel not mixed, query not expression)",
			createV1beta1: func() *dashv1.Dashboard {
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
			createV1beta1: func() *dashv1.Dashboard {
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
			createV1beta1: func() *dashv1.Dashboard {
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
			name: "panel datasource null and target has no datasource field - no default set",
			createV1beta1: func() *dashv1.Dashboard {
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
			createV1beta1: func() *dashv1.Dashboard {
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
			createV1beta1: func() *dashv1.Dashboard {
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
			createV1beta1: func() *dashv1.Dashboard {
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
				assert.Equal(t, 3, totalQueries, "All 3 queries should be preserved")
			},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			v1beta1Dash := tt.createV1beta1()

			// Convert to v2alpha1
			var v2alpha1Dash dashv2alpha1.Dashboard
			err := scheme.Convert(v1beta1Dash, &v2alpha1Dash, nil)
			require.NoError(t, err)

			// Validate the conversion result
			tt.validateV2alpha1(t, &v2alpha1Dash)
		})
	}
}

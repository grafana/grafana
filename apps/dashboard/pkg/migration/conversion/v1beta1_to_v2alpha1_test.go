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
			name: "panel datasource type datasource with no UID - resolves to grafana UID",
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
			name: "empty target datasource objects inherit from panel datasource",
			createV1beta1: func() *dashv1.Dashboard {
				return &dashv1.Dashboard{
					Spec: dashv1.DashboardSpec{
						Object: map[string]interface{}{
							"title": "Test Dashboard",
							"panels": []interface{}{
								map[string]interface{}{
									"id":   1,
									"type": "bargauge",
									// Panel datasource is set
									"datasource": map[string]interface{}{
										"type": "prometheus",
										"uid":  "prometheus-uid",
									},
									"targets": []interface{}{
										map[string]interface{}{
											"refId":      "A",
											"scenarioId": "random_walk",
											// Target datasource is empty object {} - should inherit from panel
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

				// Verify queries inherit panel datasource
				require.Len(t, panel.Spec.Data.Spec.Queries, 2)
				for _, query := range panel.Spec.Data.Spec.Queries {
					require.NotNil(t, query.Spec.Datasource, "Query should inherit datasource from panel when target datasource is empty")
					assert.Equal(t, "prometheus", *query.Spec.Datasource.Type)
					assert.Equal(t, "prometheus-uid", *query.Spec.Datasource.Uid)
					assert.Equal(t, "prometheus", query.Spec.Query.Kind)
				}
			},
		},
		{
			name: "panel datasource null without empty target datasource objects - no default set",
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

				// Verify queries don't have datasource when panel is null and targets don't have empty datasource objects
				require.Len(t, panel.Spec.Data.Spec.Queries, 1)
				query := panel.Spec.Data.Spec.Queries[0]
				// Query should not have datasource when panel datasource is null and target doesn't have empty datasource object
				assert.Nil(t, query.Spec.Datasource, "Query should not have datasource when panel datasource is null and target has no empty datasource object")
			},
		},
		{
			name: "empty panel datasource object preserved as empty",
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

				// Verify queries don't have datasource when panel datasource is empty object {}
				require.Len(t, panel.Spec.Data.Spec.Queries, 1)
				query := panel.Spec.Data.Spec.Queries[0]
				// Empty objects {} should be preserved as empty, not converted to defaults
				assert.Nil(t, query.Spec.Datasource, "Query should not have datasource when panel datasource is empty object {}")
				assert.Equal(t, "", query.Spec.Query.Kind, "Query kind should be empty when datasource is empty object {}")
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

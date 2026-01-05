package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

// TestV2alpha1ToV2beta1 tests the conversion logic for v2alpha1 to v2beta1.
func TestV2alpha1ToV2beta1(t *testing.T) {
	// Initialize the migrator with test providers
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	testCases := []struct {
		name            string
		createV2alpha1  func() *dashv2alpha1.Dashboard
		validateV2beta1 func(t *testing.T, v2beta1 *dashv2beta1.Dashboard)
	}{
		{
			name: "dashboard with switch variable",
			createV2alpha1: func() *dashv2alpha1.Dashboard {
				label := "Enable Feature"
				description := "Toggle feature"
				return &dashv2alpha1.Dashboard{
					Spec: dashv2alpha1.DashboardSpec{
						Title: "Test Dashboard",
						Variables: []dashv2alpha1.DashboardVariableKind{
							{
								SwitchVariableKind: &dashv2alpha1.DashboardSwitchVariableKind{
									Kind: "SwitchVariable",
									Spec: dashv2alpha1.DashboardSwitchVariableSpec{
										Name:          "switch_var",
										Current:       "false",
										EnabledValue:  "true",
										DisabledValue: "false",
										Label:         &label,
										Description:   &description,
										Hide:          dashv2alpha1.DashboardVariableHideDontHide,
										SkipUrlSync:   false,
									},
								},
							},
						},
					},
				}
			},
			validateV2beta1: func(t *testing.T, v2beta1 *dashv2beta1.Dashboard) {
				require.Len(t, v2beta1.Spec.Variables, 1)
				variable := v2beta1.Spec.Variables[0]
				require.NotNil(t, variable.SwitchVariableKind, "SwitchVariableKind should not be nil")
				assert.Equal(t, "SwitchVariable", variable.SwitchVariableKind.Kind)
				assert.Equal(t, "switch_var", variable.SwitchVariableKind.Spec.Name)
				assert.Equal(t, "false", variable.SwitchVariableKind.Spec.Current)
				assert.Equal(t, "true", variable.SwitchVariableKind.Spec.EnabledValue)
				assert.Equal(t, "false", variable.SwitchVariableKind.Spec.DisabledValue)
				assert.NotNil(t, variable.SwitchVariableKind.Spec.Label)
				assert.Equal(t, "Enable Feature", *variable.SwitchVariableKind.Spec.Label)
				assert.NotNil(t, variable.SwitchVariableKind.Spec.Description)
				assert.Equal(t, "Toggle feature", *variable.SwitchVariableKind.Spec.Description)
				assert.Equal(t, dashv2beta1.DashboardVariableHideDontHide, variable.SwitchVariableKind.Spec.Hide)
				assert.False(t, variable.SwitchVariableKind.Spec.SkipUrlSync)
			},
		},
		{
			name: "dashboard with switch variable - custom values for enabled and disable states",
			createV2alpha1: func() *dashv2alpha1.Dashboard {
				label := "Enable Feature"
				description := "Toggle feature"
				return &dashv2alpha1.Dashboard{
					Spec: dashv2alpha1.DashboardSpec{
						Title: "Test Dashboard",
						Variables: []dashv2alpha1.DashboardVariableKind{
							{
								SwitchVariableKind: &dashv2alpha1.DashboardSwitchVariableKind{
									Kind: "SwitchVariable",
									Spec: dashv2alpha1.DashboardSwitchVariableSpec{
										Name:          "switch_var",
										Current:       "true",
										EnabledValue:  "enabled",
										DisabledValue: "disabled",
										Label:         &label,
										Description:   &description,
										Hide:          dashv2alpha1.DashboardVariableHideHideLabel,
										SkipUrlSync:   true,
									},
								},
							},
						},
					},
				}
			},
			validateV2beta1: func(t *testing.T, v2beta1 *dashv2beta1.Dashboard) {
				require.Len(t, v2beta1.Spec.Variables, 1)
				variable := v2beta1.Spec.Variables[0]
				require.NotNil(t, variable.SwitchVariableKind)
				assert.Equal(t, "switch_var", variable.SwitchVariableKind.Spec.Name)
				assert.Equal(t, "true", variable.SwitchVariableKind.Spec.Current)
				assert.Equal(t, "enabled", variable.SwitchVariableKind.Spec.EnabledValue)
				assert.Equal(t, "disabled", variable.SwitchVariableKind.Spec.DisabledValue)
				assert.Equal(t, dashv2beta1.DashboardVariableHideHideLabel, variable.SwitchVariableKind.Spec.Hide)
				assert.True(t, variable.SwitchVariableKind.Spec.SkipUrlSync)
			},
		},
		{
			name: "annotation query with mappings",
			createV2alpha1: func() *dashv2alpha1.Dashboard {
				sourceField := "field"
				sourceText := "text"
				valueService := "service"
				valueConstant := "constant text"
				regexPattern := "/(.*)/"
				return &dashv2alpha1.Dashboard{
					Spec: dashv2alpha1.DashboardSpec{
						Title: "Test Dashboard",
						Annotations: []dashv2alpha1.DashboardAnnotationQueryKind{
							{
								Kind: "AnnotationQuery",
								Spec: dashv2alpha1.DashboardAnnotationQuerySpec{
									Name:      "Test Annotation",
									Enable:    true,
									Hide:      false,
									IconColor: "red",
									Query: &dashv2alpha1.DashboardDataQueryKind{
										Kind: "prometheus",
										Spec: map[string]interface{}{
											"expr": "test_query",
										},
									},
									Mappings: map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{
										"title": {
											Source: &sourceField,
											Value:  &valueService,
										},
										"text": {
											Source: &sourceText,
											Value:  &valueConstant,
										},
										"tags": {
											Source: &sourceField,
											Value:  &valueService,
											Regex:  &regexPattern,
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2beta1: func(t *testing.T, v2beta1 *dashv2beta1.Dashboard) {
				require.Len(t, v2beta1.Spec.Annotations, 1)
				annotation := v2beta1.Spec.Annotations[0]
				assert.Equal(t, "Test Annotation", annotation.Spec.Name)

				// Verify mappings are preserved
				require.NotNil(t, annotation.Spec.Mappings)
				assert.Len(t, annotation.Spec.Mappings, 3)

				// Check title mapping
				titleMapping, ok := annotation.Spec.Mappings["title"]
				require.True(t, ok)
				assert.Equal(t, "field", *titleMapping.Source)
				assert.Equal(t, "service", *titleMapping.Value)
				assert.Nil(t, titleMapping.Regex)

				// Check text mapping
				textMapping, ok := annotation.Spec.Mappings["text"]
				require.True(t, ok)
				assert.Equal(t, "text", *textMapping.Source)
				assert.Equal(t, "constant text", *textMapping.Value)
				assert.Nil(t, textMapping.Regex)

				// Check tags mapping
				tagsMapping, ok := annotation.Spec.Mappings["tags"]
				require.True(t, ok)
				assert.Equal(t, "field", *tagsMapping.Source)
				assert.Equal(t, "service", *tagsMapping.Value)
				assert.Equal(t, "/(.*)/", *tagsMapping.Regex)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create v2alpha1 dashboard
			v2alpha1 := tc.createV2alpha1()

			// Collect original statistics
			originalStats := collectStatsV2alpha1(v2alpha1.Spec)

			// Convert to v2beta1
			var v2beta1 dashv2beta1.Dashboard
			err := scheme.Convert(v2alpha1, &v2beta1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 to v2beta1")

			// Collect v2beta1 statistics
			v2beta1Stats := collectStatsV2beta1(v2beta1.Spec)

			// Verify no data loss
			err = detectConversionDataLoss(originalStats, v2beta1Stats, "V2alpha1", "V2beta1")
			assert.NoError(t, err, "Data loss detected in conversion")

			// Run custom validation
			tc.validateV2beta1(t, &v2beta1)
		})
	}
}

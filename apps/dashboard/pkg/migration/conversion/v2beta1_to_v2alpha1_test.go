package conversion

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

// TestV2beta1ToV2alpha1RoundTrip tests round-trip conversion: v2beta1 → v2alpha1 → v2beta1
// This ensures no data loss during conversion between v2 versions
func TestV2beta1ToV2alpha1RoundTrip(t *testing.T) {
	// Initialize the migrator with test providers
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	// Read all v2beta1 output files (these are converted from v1beta1 or v2alpha1)
	outputDir := filepath.Join("testdata", "output")
	files, err := os.ReadDir(outputDir)
	require.NoError(t, err, "Failed to read output directory")

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Only process v2beta1 files
		if !strings.Contains(file.Name(), ".v2beta1.json") {
			continue
		}

		t.Run(fmt.Sprintf("RoundTrip_%s", file.Name()), func(t *testing.T) {
			// Read v2beta1 dashboard file
			inputFile := filepath.Join(outputDir, file.Name())
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			inputData, err := os.ReadFile(inputFile)
			require.NoError(t, err, "Failed to read input file")

			// Parse v2beta1 dashboard
			var originalV2beta1 dashv2beta1.Dashboard
			err = json.Unmarshal(inputData, &originalV2beta1)
			require.NoError(t, err, "Failed to unmarshal v2beta1 dashboard")

			// Collect original statistics
			originalStats := collectStatsV2beta1(originalV2beta1.Spec)

			// Step 1: Convert v2beta1 → v2alpha1
			var v2alpha1 dashv2alpha1.Dashboard
			err = scheme.Convert(&originalV2beta1, &v2alpha1, nil)
			require.NoError(t, err, "Failed to convert v2beta1 to v2alpha1")

			// Collect v2alpha1 statistics
			v2alpha1Stats := collectStatsV2alpha1(v2alpha1.Spec)

			// Verify no data loss in first conversion
			err = detectConversionDataLoss(originalStats, v2alpha1Stats, "V2beta1", "V2alpha1")
			assert.NoError(t, err, "Data loss detected in v2beta1 → v2alpha1 conversion")

			// Step 2: Convert v2alpha1 → v2beta1 (back)
			var roundTripV2beta1 dashv2beta1.Dashboard
			err = scheme.Convert(&v2alpha1, &roundTripV2beta1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 back to v2beta1")

			// Collect round-trip statistics
			roundTripStats := collectStatsV2beta1(roundTripV2beta1.Spec)

			// Verify no data loss in round-trip conversion
			err = detectConversionDataLoss(originalStats, roundTripStats, "V2beta1", "V2beta1_RoundTrip")
			assert.NoError(t, err, "Data loss detected in round-trip conversion")

			// Verify counts match exactly
			assert.Equal(t, originalStats.panelCount, roundTripStats.panelCount, "Panel count mismatch after round-trip")
			assert.Equal(t, originalStats.queryCount, roundTripStats.queryCount, "Query count mismatch after round-trip")
			assert.Equal(t, originalStats.annotationCount, roundTripStats.annotationCount, "Annotation count mismatch after round-trip")
			assert.Equal(t, originalStats.linkCount, roundTripStats.linkCount, "Link count mismatch after round-trip")
			assert.Equal(t, originalStats.variableCount, roundTripStats.variableCount, "Variable count mismatch after round-trip")

			// Compare the entire v2beta1 spec before and after round-trip - they should be exactly equal
			assert.Equal(t, originalV2beta1.Spec, roundTripV2beta1.Spec, "v2beta1 spec should be exactly equal before and after round-trip conversion")
		})
	}
}

// TestV2beta1ToV2alpha1FromOutputFiles tests conversion from v2beta1 output files back to v2alpha1
// and compares with the original v2alpha1 input files to ensure the conversion is correct.
// This test takes files from output directory that are prefixed with "v2alpha1." and suffixed with ".v2beta1.json",
// converts them from v2beta1 to v2alpha1, and compares the result with the corresponding input file.
func TestV2beta1ToV2alpha1FromOutputFiles(t *testing.T) {
	// Initialize the migrator with test providers
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	// Read all v2beta1 output files that were converted from v2alpha1
	outputDir := filepath.Join("testdata", "output")
	files, err := os.ReadDir(outputDir)
	require.NoError(t, err, "Failed to read output directory")

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Only process files that are prefixed with "v2alpha1." and suffixed with ".v2beta1.json"
		// These are v2beta1 files that were converted from v2alpha1 input files
		if !strings.HasPrefix(file.Name(), "v2alpha1.") || !strings.HasSuffix(file.Name(), ".v2beta1.json") {
			continue
		}

		// Extract the base name (e.g., "v2alpha1.complete" from "v2alpha1.complete.v2beta1.json")
		baseName := strings.TrimSuffix(file.Name(), ".v2beta1.json")
		// The corresponding input file should be "v2alpha1.complete.json"
		expectedInputFile := baseName + ".json"

		t.Run(fmt.Sprintf("Convert_%s", file.Name()), func(t *testing.T) {
			// Read the v2beta1 output file
			v2beta1OutputFile := filepath.Join(outputDir, file.Name())
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			v2beta1Data, err := os.ReadFile(v2beta1OutputFile)
			require.NoError(t, err, "Failed to read v2beta1 output file")

			// Parse v2beta1 dashboard
			var v2beta1 dashv2beta1.Dashboard
			err = json.Unmarshal(v2beta1Data, &v2beta1)
			require.NoError(t, err, "Failed to unmarshal v2beta1 dashboard")

			// Convert v2beta1 → v2alpha1
			var convertedV2alpha1 dashv2alpha1.Dashboard
			err = scheme.Convert(&v2beta1, &convertedV2alpha1, nil)
			require.NoError(t, err, "Failed to convert v2beta1 to v2alpha1")

			// Read the original v2alpha1 input file
			inputDir := filepath.Join("testdata", "input")
			expectedInputPath := filepath.Join(inputDir, expectedInputFile)
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			expectedInputData, err := os.ReadFile(expectedInputPath)
			if err != nil {
				t.Skipf("Skipping test: expected input file %s not found", expectedInputFile)
				return
			}

			// Parse expected v2alpha1 dashboard
			var expectedV2alpha1 dashv2alpha1.Dashboard
			err = json.Unmarshal(expectedInputData, &expectedV2alpha1)
			require.NoError(t, err, "Failed to unmarshal expected v2alpha1 dashboard")

			// Compare statistics to ensure no data loss
			expectedStats := collectStatsV2alpha1(expectedV2alpha1.Spec)
			convertedStats := collectStatsV2alpha1(convertedV2alpha1.Spec)

			// Verify no data loss using statistics
			assert.Equal(t, expectedStats.panelCount, convertedStats.panelCount, "Panel count mismatch")
			assert.Equal(t, expectedStats.queryCount, convertedStats.queryCount, "Query count mismatch")
			assert.Equal(t, expectedStats.annotationCount, convertedStats.annotationCount, "Annotation count mismatch")
			assert.Equal(t, expectedStats.linkCount, convertedStats.linkCount, "Link count mismatch")
			assert.Equal(t, expectedStats.variableCount, convertedStats.variableCount, "Variable count mismatch")

			// Compare the entire spec structures - they should be equal
			assert.Equal(t, expectedV2alpha1.Spec, convertedV2alpha1.Spec, "Converted v2alpha1 spec should match expected v2alpha1 spec")
		})
	}
}

// TestV2beta1ToV2alpha1 tests the conversion logic for v2beta1 to v2alpha1.
// The conversion uses the Group field directly as the query kind and datasource type.
// No fallback mechanisms (provider lookup or UID inference) are used.
func TestV2beta1ToV2alpha1(t *testing.T) {
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
		createV2beta1    func() *dashv2beta1.Dashboard
		validateV2alpha1 func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard)
	}{
		{
			name: "dashboard with panels and queries - datasource extraction",
			createV2beta1: func() *dashv2beta1.Dashboard {
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Elements: map[string]dashv2beta1.DashboardElement{
							"panel-1": {
								PanelKind: &dashv2beta1.DashboardPanelKind{
									Kind: "Panel",
									Spec: dashv2beta1.DashboardPanelSpec{
										Id:    1,
										Title: "Test Panel",
										Data: dashv2beta1.DashboardQueryGroupKind{
											Spec: dashv2beta1.DashboardQueryGroupSpec{
												Queries: []dashv2beta1.DashboardPanelQueryKind{
													{
														Kind: "PanelQuery",
														Spec: dashv2beta1.DashboardPanelQuerySpec{
															RefId:  "A",
															Hidden: false,
															Query: dashv2beta1.DashboardDataQueryKind{
																Kind:    "DataQuery",
																Version: "v0",
																Group:   "prometheus",
																Datasource: &dashv2beta1.DashboardV2beta1DataQueryKindDatasource{
																	Name: stringPtr("prometheus-uid"),
																},
																Spec: map[string]interface{}{
																	"expr": "up",
																},
															},
														},
													},
												},
											},
										},
										VizConfig: dashv2beta1.DashboardVizConfigKind{
											Kind:    "VizConfig",
											Group:   "timeseries",
											Version: "1.0.0",
											Spec: dashv2beta1.DashboardVizConfigSpec{
												Options: map[string]interface{}{},
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
				assert.Equal(t, "Test Dashboard", v2alpha1.Spec.Title)
				assert.NotNil(t, v2alpha1.Spec.Elements["panel-1"])
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)
				assert.Equal(t, float64(1), panel.Spec.Id)
				assert.Equal(t, "Test Panel", panel.Spec.Title)
				// Verify datasource was moved from query to panel query spec
				require.Len(t, panel.Spec.Data.Spec.Queries, 1)
				query := panel.Spec.Data.Spec.Queries[0]
				assert.NotNil(t, query.Spec.Datasource)
				assert.Equal(t, "prometheus-uid", *query.Spec.Datasource.Uid)
				assert.Equal(t, "prometheus", *query.Spec.Datasource.Type)
				// Verify query kind was extracted from group
				assert.Equal(t, "prometheus", query.Spec.Query.Kind)
				// Verify vizConfig was converted
				assert.Equal(t, "timeseries", panel.Spec.VizConfig.Kind)
				assert.Equal(t, "1.0.0", panel.Spec.VizConfig.Spec.PluginVersion)
			},
		},
		{
			name: "empty group in panel query - preserved as empty kind",
			createV2beta1: func() *dashv2beta1.Dashboard {
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Elements: map[string]dashv2beta1.DashboardElement{
							"panel-1": {
								PanelKind: &dashv2beta1.DashboardPanelKind{
									Kind: "Panel",
									Spec: dashv2beta1.DashboardPanelSpec{
										Id:    1,
										Title: "Test Panel",
										Data: dashv2beta1.DashboardQueryGroupKind{
											Spec: dashv2beta1.DashboardQueryGroupSpec{
												Queries: []dashv2beta1.DashboardPanelQueryKind{
													{
														Kind: "PanelQuery",
														Spec: dashv2beta1.DashboardPanelQuerySpec{
															RefId:  "A",
															Hidden: false,
															Query: dashv2beta1.DashboardDataQueryKind{
																Kind:    "DataQuery",
																Version: "v0",
																Group:   "", // Empty group
																Spec: map[string]interface{}{
																	"expr": "up",
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
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				panel := v2alpha1.Spec.Elements["panel-1"].PanelKind
				require.NotNil(t, panel)
				require.Len(t, panel.Spec.Data.Spec.Queries, 1)
				query := panel.Spec.Data.Spec.Queries[0]
				assert.Equal(t, "", query.Spec.Query.Kind, "Empty group should result in empty kind")
			},
		},
		{
			name: "dashboard with annotations - datasource extraction",
			createV2beta1: func() *dashv2beta1.Dashboard {
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Annotations: []dashv2beta1.DashboardAnnotationQueryKind{
							{
								Kind: "AnnotationQuery",
								Spec: dashv2beta1.DashboardAnnotationQuerySpec{
									Name:   "Test Annotation",
									Enable: true,
									Query: dashv2beta1.DashboardDataQueryKind{
										Kind:    "DataQuery",
										Version: "v0",
										Group:   "prometheus",
										Datasource: &dashv2beta1.DashboardV2beta1DataQueryKindDatasource{
											Name: stringPtr("prometheus-uid"),
										},
										Spec: map[string]interface{}{
											"expr": "up",
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.Len(t, v2alpha1.Spec.Annotations, 1)
				annotation := v2alpha1.Spec.Annotations[0]
				assert.Equal(t, "Test Annotation", annotation.Spec.Name)
				assert.True(t, annotation.Spec.Enable)
				// Verify datasource was moved from query to annotation spec
				assert.NotNil(t, annotation.Spec.Datasource)
				assert.Equal(t, "prometheus-uid", *annotation.Spec.Datasource.Uid)
				assert.Equal(t, "prometheus", *annotation.Spec.Datasource.Type)
				// Verify query kind was extracted from group
				require.NotNil(t, annotation.Spec.Query)
				assert.Equal(t, "prometheus", annotation.Spec.Query.Kind)
			},
		},
		{
			name: "empty group in annotation query - preserved as empty kind",
			createV2beta1: func() *dashv2beta1.Dashboard {
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Annotations: []dashv2beta1.DashboardAnnotationQueryKind{
							{
								Kind: "AnnotationQuery",
								Spec: dashv2beta1.DashboardAnnotationQuerySpec{
									Name:   "Test Annotation",
									Enable: true,
									Query: dashv2beta1.DashboardDataQueryKind{
										Kind:    "DataQuery",
										Version: "v0",
										Group:   "", // Empty group
										Spec: map[string]interface{}{
											"expr": "up",
										},
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.Len(t, v2alpha1.Spec.Annotations, 1)
				annotation := v2alpha1.Spec.Annotations[0]
				require.NotNil(t, annotation.Spec.Query)
				assert.Equal(t, "", annotation.Spec.Query.Kind, "Empty group should result in empty kind")
			},
		},
		{
			name: "dashboard with query variable - datasource extraction",
			createV2beta1: func() *dashv2beta1.Dashboard {
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Variables: []dashv2beta1.DashboardVariableKind{
							{
								QueryVariableKind: &dashv2beta1.DashboardQueryVariableKind{
									Kind: "QueryVariable",
									Spec: dashv2beta1.DashboardQueryVariableSpec{
										Name: "testVar",
										Query: dashv2beta1.DashboardDataQueryKind{
											Kind:    "DataQuery",
											Version: "v0",
											Group:   "prometheus",
											Datasource: &dashv2beta1.DashboardV2beta1DataQueryKindDatasource{
												Name: stringPtr("prometheus-uid"),
											},
											Spec: map[string]interface{}{
												"expr": "label_values(up, instance)",
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
				require.Len(t, v2alpha1.Spec.Variables, 1)
				variable := v2alpha1.Spec.Variables[0]
				require.NotNil(t, variable.QueryVariableKind)
				assert.Equal(t, "testVar", variable.QueryVariableKind.Spec.Name)
				// Verify datasource was moved from query to variable spec
				assert.NotNil(t, variable.QueryVariableKind.Spec.Datasource)
				assert.Equal(t, "prometheus-uid", *variable.QueryVariableKind.Spec.Datasource.Uid)
				assert.Equal(t, "prometheus", *variable.QueryVariableKind.Spec.Datasource.Type)
				// Verify query kind was extracted from group
				assert.Equal(t, "prometheus", variable.QueryVariableKind.Spec.Query.Kind)
			},
		},
		{
			name: "empty group in query variable - preserved as empty kind",
			createV2beta1: func() *dashv2beta1.Dashboard {
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Variables: []dashv2beta1.DashboardVariableKind{
							{
								QueryVariableKind: &dashv2beta1.DashboardQueryVariableKind{
									Kind: "QueryVariable",
									Spec: dashv2beta1.DashboardQueryVariableSpec{
										Name: "testVar",
										Query: dashv2beta1.DashboardDataQueryKind{
											Kind:    "DataQuery",
											Version: "v0",
											Group:   "", // Empty group
											Spec: map[string]interface{}{
												"expr": "label_values(up, instance)",
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
				require.Len(t, v2alpha1.Spec.Variables, 1)
				variable := v2alpha1.Spec.Variables[0]
				require.NotNil(t, variable.QueryVariableKind)
				assert.Equal(t, "", variable.QueryVariableKind.Spec.Query.Kind, "Empty group should result in empty kind")
			},
		},
		{
			name: "dashboard with switch variable",
			createV2beta1: func() *dashv2beta1.Dashboard {
				label := "Enable Feature"
				description := "Toggle feature"
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Variables: []dashv2beta1.DashboardVariableKind{
							{
								SwitchVariableKind: &dashv2beta1.DashboardSwitchVariableKind{
									Kind: "SwitchVariable",
									Spec: dashv2beta1.DashboardSwitchVariableSpec{
										Name:          "switch_var",
										Current:       "false",
										EnabledValue:  "true",
										DisabledValue: "false",
										Label:         &label,
										Description:   &description,
										Hide:          dashv2beta1.DashboardVariableHideDontHide,
										SkipUrlSync:   false,
									},
								},
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.Len(t, v2alpha1.Spec.Variables, 1)
				variable := v2alpha1.Spec.Variables[0]
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
				assert.Equal(t, dashv2alpha1.DashboardVariableHideDontHide, variable.SwitchVariableKind.Spec.Hide)
				assert.False(t, variable.SwitchVariableKind.Spec.SkipUrlSync)
			},
		},
		{
			name: "dashboard with rows layout",
			createV2beta1: func() *dashv2beta1.Dashboard {
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Elements: map[string]dashv2beta1.DashboardElement{
							"panel-1": {
								PanelKind: &dashv2beta1.DashboardPanelKind{
									Kind: "Panel",
									Spec: dashv2beta1.DashboardPanelSpec{
										Id:    1,
										Title: "Panel 1",
									},
								},
							},
						},
						Layout: dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
							RowsLayoutKind: &dashv2beta1.DashboardRowsLayoutKind{
								Kind: "RowsLayout",
								Spec: dashv2beta1.DashboardRowsLayoutSpec{
									Rows: []dashv2beta1.DashboardRowsLayoutRowKind{
										{
											Kind: "RowsLayoutRow",
											Spec: dashv2beta1.DashboardRowsLayoutRowSpec{
												Title:    stringPtr("Row 1"),
												Collapse: boolPtr(false),
												Layout: dashv2beta1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
													GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
														Kind: "GridLayout",
														Spec: dashv2beta1.DashboardGridLayoutSpec{
															Items: []dashv2beta1.DashboardGridLayoutItemKind{
																{
																	Kind: "GridLayoutItem",
																	Spec: dashv2beta1.DashboardGridLayoutItemSpec{
																		Element: dashv2beta1.DashboardElementReference{
																			Kind: "ElementReference",
																			Name: "panel-1",
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
							},
						},
					},
				}
			},
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.NotNil(t, v2alpha1.Spec.Layout.RowsLayoutKind)
				require.Len(t, v2alpha1.Spec.Layout.RowsLayoutKind.Spec.Rows, 1)
				row := v2alpha1.Spec.Layout.RowsLayoutKind.Spec.Rows[0]
				assert.Equal(t, "Row 1", *row.Spec.Title)
				assert.False(t, *row.Spec.Collapse)
			},
		},
		{
			name: "annotation query with mappings",
			createV2beta1: func() *dashv2beta1.Dashboard {
				sourceField := "field"
				sourceText := "text"
				valueService := "service"
				valueConstant := "constant text"
				regexPattern := "/(.*)/"
				return &dashv2beta1.Dashboard{
					Spec: dashv2beta1.DashboardSpec{
						Title: "Test Dashboard",
						Annotations: []dashv2beta1.DashboardAnnotationQueryKind{
							{
								Kind: "AnnotationQuery",
								Spec: dashv2beta1.DashboardAnnotationQuerySpec{
									Name:      "Test Annotation",
									Enable:    true,
									Hide:      false,
									IconColor: "red",
									Query: dashv2beta1.DashboardDataQueryKind{
										Kind:    "DataQuery",
										Group:   "prometheus",
										Version: "v0",
										Spec: map[string]interface{}{
											"expr": "test_query",
										},
									},
									Mappings: map[string]dashv2beta1.DashboardAnnotationEventFieldMapping{
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
			validateV2alpha1: func(t *testing.T, v2alpha1 *dashv2alpha1.Dashboard) {
				require.Len(t, v2alpha1.Spec.Annotations, 1)
				annotation := v2alpha1.Spec.Annotations[0]
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
			// Create v2beta1 dashboard
			v2beta1 := tc.createV2beta1()

			// Collect original statistics
			originalStats := collectStatsV2beta1(v2beta1.Spec)

			// Convert to v2alpha1
			var v2alpha1 dashv2alpha1.Dashboard
			err := scheme.Convert(v2beta1, &v2alpha1, nil)
			require.NoError(t, err, "Failed to convert v2beta1 to v2alpha1")

			// Collect v2alpha1 statistics
			v2alpha1Stats := collectStatsV2alpha1(v2alpha1.Spec)

			// Verify no data loss
			err = detectConversionDataLoss(originalStats, v2alpha1Stats, "V2beta1", "V2alpha1")
			assert.NoError(t, err, "Data loss detected in conversion")

			// Run custom validation
			tc.validateV2alpha1(t, &v2alpha1)
		})
	}
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}

// Helper function to create bool pointer
func boolPtr(b bool) *bool {
	return &b
}

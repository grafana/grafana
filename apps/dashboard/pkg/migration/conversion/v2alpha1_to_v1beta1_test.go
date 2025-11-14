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
	"k8s.io/utils/ptr"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

// TestV2alpha1ToV1beta1RoundTrip tests round-trip conversion: v2alpha1 → v1beta1 → v2alpha1
// This ensures no data loss during conversion between v2alpha1 and v1beta1
func TestV2alpha1ToV1beta1RoundTrip(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	migration.Initialize(dsProvider)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider)
	require.NoError(t, err)

	// Read all v2alpha1 input files
	inputDir := filepath.Join("testdata", "input")
	files, err := os.ReadDir(inputDir)
	require.NoError(t, err, "Failed to read input directory")

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Only process v2alpha1 input files
		if !strings.HasPrefix(file.Name(), "v2alpha1.") || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		t.Run(fmt.Sprintf("RoundTrip_%s", file.Name()), func(t *testing.T) {
			// Read v2alpha1 dashboard file
			inputFile := filepath.Join(inputDir, file.Name())
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			inputData, err := os.ReadFile(inputFile)
			require.NoError(t, err, "Failed to read input file")

			// Parse v2alpha1 dashboard
			var originalV2alpha1 dashv2alpha1.Dashboard
			err = json.Unmarshal(inputData, &originalV2alpha1)
			require.NoError(t, err, "Failed to unmarshal v2alpha1 dashboard")

			// Collect original statistics
			originalStats := collectStatsV2alpha1(originalV2alpha1.Spec)

			// Step 1: Convert v2alpha1 → v1beta1
			var v1beta1 dashv1.Dashboard
			err = scheme.Convert(&originalV2alpha1, &v1beta1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 to v1beta1")

			// Step 2: Convert v1beta1 → v2alpha1 (back)
			var roundTripV2alpha1 dashv2alpha1.Dashboard
			err = scheme.Convert(&v1beta1, &roundTripV2alpha1, nil)
			require.NoError(t, err, "Failed to convert v1beta1 back to v2alpha1")

			// Collect round-trip statistics
			roundTripStats := collectStatsV2alpha1(roundTripV2alpha1.Spec)

			// Verify no data loss in round-trip conversion
			err = detectConversionDataLoss(originalStats, roundTripStats, "V2alpha1", "V2alpha1_RoundTrip")
			assert.NoError(t, err, "Data loss detected in round-trip conversion")

			// Verify counts match exactly
			assert.Equal(t, originalStats.panelCount, roundTripStats.panelCount, "Panel count mismatch after round-trip")
			assert.Equal(t, originalStats.queryCount, roundTripStats.queryCount, "Query count mismatch after round-trip")
			assert.Equal(t, originalStats.annotationCount, roundTripStats.annotationCount, "Annotation count mismatch after round-trip")
			assert.Equal(t, originalStats.linkCount, roundTripStats.linkCount, "Link count mismatch after round-trip")
			assert.Equal(t, originalStats.variableCount, roundTripStats.variableCount, "Variable count mismatch after round-trip")
		})
	}
}

// TestV2alpha1ToV1beta1WriteOutputFiles writes output files from v2alpha1 input files
// This test reads v2alpha1 input files, converts them to v1beta1, and writes the output files
func TestV2alpha1ToV1beta1WriteOutputFiles(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	migration.Initialize(dsProvider)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider)
	require.NoError(t, err)

	// Read all v2alpha1 input files
	inputDir := filepath.Join("testdata", "input")
	files, err := os.ReadDir(inputDir)
	require.NoError(t, err, "Failed to read input directory")

	// Ensure output directory exists
	outputDir := filepath.Join("testdata", "output")
	// ignore gosec G301 as this function is only used in the test process
	//nolint:gosec
	err = os.MkdirAll(outputDir, 0755)
	require.NoError(t, err, "Failed to create output directory")

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Only process v2alpha1 input files
		if !strings.HasPrefix(file.Name(), "v2alpha1.") || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		// Extract the base name (e.g., "v2alpha1.complete" from "v2alpha1.complete.json")
		baseName := strings.TrimSuffix(file.Name(), ".json")
		// The output file should be "v2alpha1.complete.v1beta1.json"
		outputFileName := baseName + ".v1beta1.json"

		t.Run(fmt.Sprintf("WriteOutput_%s", file.Name()), func(t *testing.T) {
			// Read the v2alpha1 input file
			inputFile := filepath.Join(inputDir, file.Name())
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			inputData, err := os.ReadFile(inputFile)
			require.NoError(t, err, "Failed to read input file")

			// Parse v2alpha1 dashboard
			var v2alpha1 dashv2alpha1.Dashboard
			err = json.Unmarshal(inputData, &v2alpha1)
			require.NoError(t, err, "Failed to unmarshal v2alpha1 dashboard")

			// Convert v2alpha1 → v1beta1
			var convertedV1beta1 dashv1.Dashboard
			err = scheme.Convert(&v2alpha1, &convertedV1beta1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 to v1beta1")

			// Write output file using the shared testConversion helper
			// dashv1.Dashboard implements metav1.Object, so we can use testConversion directly
			testConversion(t, &convertedV1beta1, outputFileName, outputDir)
		})
	}
}

// TestV2alpha1ToV1beta1FromInputFiles tests conversion from v2alpha1 input files to v1beta1
// and compares with expected v1beta1 output files
func TestV2alpha1ToV1beta1FromInputFiles(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	migration.Initialize(dsProvider)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider)
	require.NoError(t, err)

	// Read all v2alpha1 input files
	inputDir := filepath.Join("testdata", "input")
	files, err := os.ReadDir(inputDir)
	require.NoError(t, err, "Failed to read input directory")

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Only process v2alpha1 input files
		if !strings.HasPrefix(file.Name(), "v2alpha1.") || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		// Extract the base name (e.g., "v2alpha1.complete" from "v2alpha1.complete.json")
		baseName := strings.TrimSuffix(file.Name(), ".json")
		// The corresponding output file should be "v2alpha1.complete.v1beta1.json"
		expectedOutputFile := baseName + ".v1beta1.json"

		t.Run(fmt.Sprintf("Convert_%s", file.Name()), func(t *testing.T) {
			// Read the v2alpha1 input file
			inputFile := filepath.Join(inputDir, file.Name())
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			inputData, err := os.ReadFile(inputFile)
			require.NoError(t, err, "Failed to read input file")

			// Parse v2alpha1 dashboard
			var v2alpha1 dashv2alpha1.Dashboard
			err = json.Unmarshal(inputData, &v2alpha1)
			require.NoError(t, err, "Failed to unmarshal v2alpha1 dashboard")

			// Convert v2alpha1 → v1beta1
			var convertedV1beta1 dashv1.Dashboard
			err = scheme.Convert(&v2alpha1, &convertedV1beta1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 to v1beta1")

			// Read the expected v1beta1 output file
			outputDir := filepath.Join("testdata", "output")
			expectedOutputPath := filepath.Join(outputDir, expectedOutputFile)
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			expectedOutputData, err := os.ReadFile(expectedOutputPath)
			if err != nil {
				t.Skipf("Skipping test: expected output file %s not found", expectedOutputFile)
				return
			}

			// Parse expected v1beta1 dashboard
			var expectedV1beta1 dashv1.Dashboard
			err = json.Unmarshal(expectedOutputData, &expectedV1beta1)
			require.NoError(t, err, "Failed to unmarshal expected v1beta1 dashboard")

			// Compare the spec structures
			// Since v1beta1 is unstructured, we compare the JSON structure
			convertedSpecJSON, err := json.Marshal(convertedV1beta1.Spec.Object)
			require.NoError(t, err, "Failed to marshal converted spec")

			expectedSpecJSON, err := json.Marshal(expectedV1beta1.Spec.Object)
			require.NoError(t, err, "Failed to marshal expected spec")

			// Compare JSON structures (normalize by unmarshaling and remarshaling)
			var convertedSpec map[string]interface{}
			var expectedSpec map[string]interface{}

			err = json.Unmarshal(convertedSpecJSON, &convertedSpec)
			require.NoError(t, err, "Failed to unmarshal converted spec")

			err = json.Unmarshal(expectedSpecJSON, &expectedSpec)
			require.NoError(t, err, "Failed to unmarshal expected spec")

			// Compare dashboard structures
			convertedDashboard, ok1 := convertedSpec["dashboard"].(map[string]interface{})
			expectedDashboard, ok2 := expectedSpec["dashboard"].(map[string]interface{})

			if ok1 && ok2 {
				// Compare key fields
				assert.Equal(t, expectedDashboard["title"], convertedDashboard["title"], "Title mismatch")
				assert.Equal(t, expectedDashboard["description"], convertedDashboard["description"], "Description mismatch")
				assert.Equal(t, expectedDashboard["tags"], convertedDashboard["tags"], "Tags mismatch")

				// Compare panels count
				expectedPanels, _ := expectedDashboard["panels"].([]interface{})
				convertedPanels, _ := convertedDashboard["panels"].([]interface{})
				assert.Equal(t, len(expectedPanels), len(convertedPanels), "Panel count mismatch")

				// Compare variables count
				expectedTemplating, _ := expectedDashboard["templating"].(map[string]interface{})
				convertedTemplating, _ := convertedDashboard["templating"].(map[string]interface{})
				if expectedTemplating != nil && convertedTemplating != nil {
					expectedVars, _ := expectedTemplating["list"].([]interface{})
					convertedVars, _ := convertedTemplating["list"].([]interface{})
					assert.Equal(t, len(expectedVars), len(convertedVars), "Variable count mismatch")
				}

				// Compare annotations count
				expectedAnnotations, _ := expectedDashboard["annotations"].(map[string]interface{})
				convertedAnnotations, _ := convertedDashboard["annotations"].(map[string]interface{})
				if expectedAnnotations != nil && convertedAnnotations != nil {
					expectedAnnList, _ := expectedAnnotations["list"].([]interface{})
					convertedAnnList, _ := convertedAnnotations["list"].([]interface{})
					assert.Equal(t, len(expectedAnnList), len(convertedAnnList), "Annotation count mismatch")
				}
			}
		})
	}
}

// TestV2alpha1ToV1beta1LayoutErrors tests that AutoGridLayout and TabsLayout return appropriate errors
func TestV2alpha1ToV1beta1LayoutErrors(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	migration.Initialize(dsProvider)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider)
	require.NoError(t, err)

	t.Run("AutoGridLayout converts to basic 3x3 grid", func(t *testing.T) {
		// Create a simple AutoGridLayout with one element
		elements := make(map[string]dashv2alpha1.DashboardElement)
		elements["panel1"] = dashv2alpha1.DashboardElement{
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id:          1,
					Title:       "Test Panel",
					Description: "",
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Kind: "QueryGroup",
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries:         []dashv2alpha1.DashboardPanelQueryKind{},
							Transformations: []dashv2alpha1.DashboardTransformationKind{},
							QueryOptions:    dashv2alpha1.DashboardQueryOptionsSpec{},
						},
					},
					VizConfig: dashv2alpha1.DashboardVizConfigKind{
						Kind: "graph",
						Spec: dashv2alpha1.DashboardVizConfigSpec{},
					},
				},
			},
		}

		v2alpha1 := dashv2alpha1.Dashboard{
			Spec: dashv2alpha1.DashboardSpec{
				Title:    "Test Dashboard",
				Elements: elements,
				Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					AutoGridLayoutKind: &dashv2alpha1.DashboardAutoGridLayoutKind{
						Kind: "AutoGridLayout",
						Spec: dashv2alpha1.DashboardAutoGridLayoutSpec{
							Items: []dashv2alpha1.DashboardAutoGridLayoutItemKind{
								{
									Kind: "AutoGridLayoutItem",
									Spec: dashv2alpha1.DashboardAutoGridLayoutItemSpec{
										Element: dashv2alpha1.DashboardElementReference{
											Kind: "ElementReference",
											Name: "panel1",
										},
									},
								},
							},
						},
					},
				},
			},
		}

		var v1beta1 dashv1.Dashboard
		err := scheme.Convert(&v2alpha1, &v1beta1, nil)
		require.NoError(t, err, "AutoGridLayout conversion should succeed")

		// Verify panels were created with 3x3 grid positioning
		dashboard, ok := v1beta1.Spec.Object["dashboard"].(map[string]interface{})
		require.True(t, ok, "Dashboard should be wrapped in 'dashboard' key")

		panels, ok := dashboard["panels"].([]interface{})
		require.True(t, ok, "Panels should exist")
		require.Len(t, panels, 1, "Should have one panel")

		panel, ok := panels[0].(map[string]interface{})
		require.True(t, ok, "Panel should be a map")

		gridPos, ok := panel["gridPos"].(map[string]interface{})
		require.True(t, ok, "Panel should have gridPos")
		assert.Equal(t, int64(0), gridPos["x"], "Panel should be at x=0 (first column)")
		assert.Equal(t, int64(0), gridPos["y"], "Panel should be at y=0 (first row)")
		// gridPos values can be int or int64 depending on JSON unmarshaling
		assert.Equal(t, int64(8), int64(getIntValue(gridPos["w"])), "Panel should be width=8 (3 columns)")
		assert.Equal(t, int64(3), int64(getIntValue(gridPos["h"])), "Panel should be height=3")
	})

	t.Run("TabsLayout converts to basic 3x3 grid", func(t *testing.T) {
		// Create a simple TabsLayout with one tab containing one panel
		elements := make(map[string]dashv2alpha1.DashboardElement)
		elements["panel1"] = dashv2alpha1.DashboardElement{
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id:          1,
					Title:       "Test Panel",
					Description: "",
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Kind: "QueryGroup",
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries:         []dashv2alpha1.DashboardPanelQueryKind{},
							Transformations: []dashv2alpha1.DashboardTransformationKind{},
							QueryOptions:    dashv2alpha1.DashboardQueryOptionsSpec{},
						},
					},
					VizConfig: dashv2alpha1.DashboardVizConfigKind{
						Kind: "graph",
						Spec: dashv2alpha1.DashboardVizConfigSpec{},
					},
				},
			},
		}

		v2alpha1 := dashv2alpha1.Dashboard{
			Spec: dashv2alpha1.DashboardSpec{
				Title:    "Test Dashboard",
				Elements: elements,
				Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					TabsLayoutKind: &dashv2alpha1.DashboardTabsLayoutKind{
						Kind: "TabsLayout",
						Spec: dashv2alpha1.DashboardTabsLayoutSpec{
							Tabs: []dashv2alpha1.DashboardTabsLayoutTabKind{
								{
									Kind: "TabsLayoutTab",
									Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
										Title: ptr.To("Tab 1"),
										Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
											GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
												Kind: "GridLayout",
												Spec: dashv2alpha1.DashboardGridLayoutSpec{
													Items: []dashv2alpha1.DashboardGridLayoutItemKind{
														{
															Kind: "GridLayoutItem",
															Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
																X:      0,
																Y:      0,
																Width:  12,
																Height: 3,
																Element: dashv2alpha1.DashboardElementReference{
																	Kind: "ElementReference",
																	Name: "panel1",
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

		var v1beta1 dashv1.Dashboard
		err := scheme.Convert(&v2alpha1, &v1beta1, nil)
		require.NoError(t, err, "TabsLayout conversion should succeed")

		// Verify panels were created with 3x3 grid positioning
		dashboard, ok := v1beta1.Spec.Object["dashboard"].(map[string]interface{})
		require.True(t, ok, "Dashboard should be wrapped in 'dashboard' key")

		panels, ok := dashboard["panels"].([]interface{})
		require.True(t, ok, "Panels should exist")
		require.Len(t, panels, 1, "Should have one panel")

		panel, ok := panels[0].(map[string]interface{})
		require.True(t, ok, "Panel should be a map")

		gridPos, ok := panel["gridPos"].(map[string]interface{})
		require.True(t, ok, "Panel should have gridPos")
		assert.Equal(t, int64(0), gridPos["x"], "Panel should be at x=0 (first column)")
		assert.Equal(t, int64(0), gridPos["y"], "Panel should be at y=0 (first row)")
		// gridPos values can be int or int64 depending on JSON unmarshaling
		assert.Equal(t, int64(8), int64(getIntValue(gridPos["w"])), "Panel should be width=8 (3 columns)")
		assert.Equal(t, int64(3), int64(getIntValue(gridPos["h"])), "Panel should be height=3")
	})
}

// getIntValue converts interface{} to int64, handling both int and int64 types
func getIntValue(v interface{}) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case int:
		return int64(val)
	case float64:
		return int64(val)
	default:
		return 0
	}
}

// TestV2alpha1ToV1beta1BasicFields tests conversion of basic dashboard fields
func TestV2alpha1ToV1beta1BasicFields(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	migration.Initialize(dsProvider)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider)
	require.NoError(t, err)

	editable := true
	liveNow := false
	revision := uint16(1)
	description := "Test Description"

	v2alpha1 := dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Title:       "Test Dashboard",
			Description: &description,
			Tags:        []string{"tag1", "tag2"},
			CursorSync:  dashv2alpha1.DashboardDashboardCursorSyncCrosshair,
			Preload:     true,
			Editable:    &editable,
			LiveNow:     &liveNow,
			Revision:    &revision,
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2alpha1.DashboardGridLayoutSpec{
						Items: []dashv2alpha1.DashboardGridLayoutItemKind{},
					},
				},
			},
		},
	}

	var v1beta1 dashv1.Dashboard
	err = scheme.Convert(&v2alpha1, &v1beta1, nil)
	require.NoError(t, err)

	// Verify the conversion
	dashboard, ok := v1beta1.Spec.Object["dashboard"].(map[string]interface{})
	require.True(t, ok, "Dashboard should be wrapped in 'dashboard' key")

	assert.Equal(t, "Test Dashboard", dashboard["title"])
	assert.Equal(t, "Test Description", dashboard["description"])
	// Tags can be []string or []interface{} depending on JSON unmarshaling
	tags := dashboard["tags"]
	assert.NotNil(t, tags)
	assert.Contains(t, tags, "tag1")
	assert.Contains(t, tags, "tag2")
	assert.Equal(t, 1, dashboard["graphTooltip"]) // Crosshair = 1
	assert.Equal(t, true, dashboard["preload"])
	assert.Equal(t, true, dashboard["editable"])
	assert.Equal(t, false, dashboard["liveNow"])
	// Revision can be uint16 or int depending on JSON unmarshaling
	if revision, ok := dashboard["revision"].(uint16); ok {
		assert.Equal(t, uint16(1), revision)
	} else if revInt, ok := dashboard["revision"].(int); ok {
		assert.Equal(t, 1, revInt)
	} else if revFloat, ok := dashboard["revision"].(float64); ok {
		assert.Equal(t, float64(1), revFloat)
	} else {
		t.Fatalf("Unexpected revision type: %T", dashboard["revision"])
	}
}

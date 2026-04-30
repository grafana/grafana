package conversion

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/ptr"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

// TestV2alpha1ToV1RoundTrip tests round-trip conversion: v2alpha1 → v1 → v2alpha1
// This ensures no data loss during conversion between v2alpha1 and v1
func TestV2alpha1ToV1RoundTrip(t *testing.T) {
	scheme := setupTestConversionScheme(t)

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
			var originalV2alpha1 dashv2alpha1.Dashboard
			readInputFile(t, inputFile, &originalV2alpha1)

			// Collect original statistics
			originalStats := collectStatsV2alpha1(originalV2alpha1.Spec)

			// Step 1: Convert v2alpha1 → v1
			var v1 dashv1.Dashboard
			err = scheme.Convert(&originalV2alpha1, &v1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 to v1")

			// Step 2: Convert v1 → v2alpha1 (back)
			var roundTripV2alpha1 dashv2alpha1.Dashboard
			err = scheme.Convert(&v1, &roundTripV2alpha1, nil)
			require.NoError(t, err, "Failed to convert v1 back to v2alpha1")

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

// TestV2alpha1ToV1WriteOutputFiles writes output files from v2alpha1 input files
// This test reads v2alpha1 input files, converts them to v1, and writes the output files
func TestV2alpha1ToV1WriteOutputFiles(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	// Read all v2alpha1 input files
	inputDir := filepath.Join("testdata", "input")
	files, err := os.ReadDir(inputDir)
	require.NoError(t, err, "Failed to read input directory")

	outputDir := filepath.Join("testdata", "output")

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
		// The output file should be "v2alpha1.complete.v1.json"
		outputFileName := baseName + ".v1.json"

		t.Run(fmt.Sprintf("WriteOutput_%s", file.Name()), func(t *testing.T) {
			// Read the v2alpha1 input file
			inputFile := filepath.Join(inputDir, file.Name())
			var v2alpha1 dashv2alpha1.Dashboard
			readInputFile(t, inputFile, &v2alpha1)

			// Convert v2alpha1 → v1
			var convertedV1 dashv1.Dashboard
			err = scheme.Convert(&v2alpha1, &convertedV1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 to v1")

			// Write output file using the shared testConversion helper
			// dashv1.Dashboard implements metav1.Object, so we can use testConversion directly
			testConversion(t, &convertedV1, outputFileName, outputDir)
		})
	}
}

// TestV2alpha1ToV2beta1WriteOutputFiles reads v2alpha1 input files from testdata/input,
// converts them to v2beta1, and writes the output to testdata/output.
// These outputs are used by the frontend test to verify consistency.
func TestV2alpha1ToV2beta1WriteOutputFiles(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	// Read all v2alpha1 input files
	inputDir := filepath.Join("testdata", "input")
	files, err := os.ReadDir(inputDir)
	require.NoError(t, err, "Failed to read input directory")

	outputDir := filepath.Join("testdata", "output")

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Only process v2alpha1 input files
		if !strings.HasPrefix(file.Name(), "v2alpha1.") {
			continue
		}

		t.Run(file.Name(), func(t *testing.T) {
			// Read input file
			inputPath := filepath.Join(inputDir, file.Name())
			var v2alpha1 dashv2alpha1.Dashboard
			readInputFile(t, inputPath, &v2alpha1)

			// Convert v2alpha1 → v2beta1
			var v2beta1 dashv2beta1.Dashboard
			err = scheme.Convert(&v2alpha1, &v2beta1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 to v2beta1")

			// Generate output filename
			baseName := strings.TrimPrefix(file.Name(), "v2alpha1.")
			baseName = strings.TrimSuffix(baseName, ".json")
			outputFileName := fmt.Sprintf("v2alpha1.%s.v2beta1.json", baseName)
			outputPath := filepath.Join(outputDir, outputFileName)

			writeOrCompareOutputFile(t, v2beta1, outputPath)
		})
	}
}

// TestV2alpha1ToV1FromInputFiles tests conversion from v2alpha1 input files to v1
// and compares with expected v1 output files
func TestV2alpha1ToV1FromInputFiles(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	// Read all v2alpha1 input files
	inputDir := filepath.Join("testdata", "input")
	files, err := os.ReadDir(inputDir)
	require.NoError(t, err, "Failed to read input directory")

	outputDir := filepath.Join("testdata", "output")

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
		// The corresponding output file should be "v2alpha1.complete.v1.json"
		expectedOutputFile := baseName + ".v1.json"

		t.Run(fmt.Sprintf("Convert_%s", file.Name()), func(t *testing.T) {
			inputFile := filepath.Join(inputDir, file.Name())
			var v2alpha1 dashv2alpha1.Dashboard
			readInputFile(t, inputFile, &v2alpha1)

			var convertedV1 dashv1.Dashboard
			err = scheme.Convert(&v2alpha1, &convertedV1, nil)
			require.NoError(t, err, "Failed to convert v2alpha1 to v1")

			expectedOutputPath := filepath.Join(outputDir, expectedOutputFile)
			writeOrCompareOutputFile(t, convertedV1, expectedOutputPath)
		})
	}
}

// TestV2alpha1ToV1LayoutErrors tests that AutoGridLayout and TabsLayout return appropriate errors
func TestV2alpha1ToV1LayoutErrors(t *testing.T) {
	// Initialize the migrator with test data source and library element providers
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	t.Run("AutoGridLayout converts to calculated grid based on rowHeightMode", func(t *testing.T) {
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
							RowHeightMode: dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeStandard,
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

		var v1 dashv1.Dashboard
		err := scheme.Convert(&v2alpha1, &v1, nil)
		require.NoError(t, err, "AutoGridLayout conversion should succeed")

		// Verify panels were created with calculated grid positioning
		// Dashboard JSON is directly at Spec.Object level (no "dashboard" wrapper)
		dashboard := v1.Spec.Object

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
		// Width: 24 / 3 (default maxColumnCount) = 8
		assert.Equal(t, int64(8), getIntValue(gridPos["w"]), "Panel should be width=8 (24/3 columns)")
		// Height: standard mode = 9 grid units (320px)
		assert.Equal(t, int64(9), getIntValue(gridPos["h"]), "Panel should be height=9 (standard mode)")
	})

	t.Run("TabsLayout converts tabs to row panels with extracted panels", func(t *testing.T) {
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

		var v1 dashv1.Dashboard
		err := scheme.Convert(&v2alpha1, &v1, nil)
		require.NoError(t, err, "TabsLayout conversion should succeed")

		// Verify: each tab becomes a row panel + extracted panels
		// Dashboard JSON is directly at Spec.Object level (no "dashboard" wrapper)
		dashboard := v1.Spec.Object

		panels, ok := dashboard["panels"].([]interface{})
		require.True(t, ok, "Panels should exist")
		require.Len(t, panels, 2, "Should have row panel + extracted panel")

		// First panel should be the row panel for the tab
		rowPanel, ok := panels[0].(map[string]interface{})
		require.True(t, ok, "Row panel should be a map")
		assert.Equal(t, "row", rowPanel["type"], "First panel should be type 'row'")
		assert.Equal(t, false, rowPanel["collapsed"], "Tab row should be expanded")
		rowGridPos, ok := rowPanel["gridPos"].(map[string]interface{})
		require.True(t, ok, "Row panel should have gridPos")
		assert.Equal(t, int64(0), rowGridPos["y"], "Row panel should be at y=0")
		assert.Equal(t, int64(24), getIntValue(rowGridPos["w"]), "Row panel should be full width")
		assert.Equal(t, int64(1), getIntValue(rowGridPos["h"]), "Row panel should be height=1")
		// Tab row's panels array should be empty (panels extracted to top level)
		rowPanels, ok := rowPanel["panels"].([]interface{})
		require.True(t, ok, "Row panel should have panels array")
		assert.Len(t, rowPanels, 0, "Tab row's panels array should be empty")

		// Second panel should be the extracted panel from the tab
		panel, ok := panels[1].(map[string]interface{})
		require.True(t, ok, "Panel should be a map")
		assert.Equal(t, "Test Panel", panel["title"], "Panel title should match")

		gridPos, ok := panel["gridPos"].(map[string]interface{})
		require.True(t, ok, "Panel should have gridPos")
		assert.Equal(t, int64(0), gridPos["x"], "Panel should be at x=0")
		// Y position should be offset by 1 (after the row panel)
		assert.Equal(t, int64(1), getIntValue(gridPos["y"]), "Panel should be at y=1 (after row)")
		assert.Equal(t, int64(12), getIntValue(gridPos["w"]), "Panel width should be preserved")
		assert.Equal(t, int64(3), getIntValue(gridPos["h"]), "Panel height should be preserved")

		// Verify panel IDs: panel1 has Id:1, row panel should get Id:2 (maxPanelID + 1)
		rowID := getIntValue(rowPanel["id"])
		panelID := getIntValue(panel["id"])
		assert.Equal(t, int64(1), panelID, "Panel ID should be 1")
		assert.Equal(t, int64(2), rowID, "Row panel ID should be 2 (maxPanelID + 1)")
	})
}

// TestExpandedRowYPositionNoOverlap verifies that panels inside expanded rows
// get Y positions below their parent row panel, with no overlap.
func TestExpandedRowYPositionNoOverlap(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	makeElement := func(name string, id int32) dashv2alpha1.DashboardElement {
		return dashv2alpha1.DashboardElement{
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id:          id,
					Title:       name,
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
	}

	t.Run("expanded row with GridLayout panels should not overlap with row panel", func(t *testing.T) {
		elements := map[string]dashv2alpha1.DashboardElement{
			"panel-1": makeElement("Panel A", 1),
			"panel-2": makeElement("Panel B", 2),
		}

		v2alpha1 := dashv2alpha1.Dashboard{
			Spec: dashv2alpha1.DashboardSpec{
				Title:    "Test Dashboard",
				Elements: elements,
				Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
						Kind: "RowsLayout",
						Spec: dashv2alpha1.DashboardRowsLayoutSpec{
							Rows: []dashv2alpha1.DashboardRowsLayoutRowKind{
								{
									Kind: "RowsLayoutRow",
									Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
										Title: ptr.To("Row A"),
										Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
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
																Height: 8,
																Element: dashv2alpha1.DashboardElementReference{
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
								{
									Kind: "RowsLayoutRow",
									Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
										Title: ptr.To("Row B"),
										Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
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
																Height: 6,
																Element: dashv2alpha1.DashboardElementReference{
																	Kind: "ElementReference",
																	Name: "panel-2",
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
		require.NoError(t, err)

		dashboard := v1beta1.Spec.Object
		panels, ok := dashboard["panels"].([]any)
		require.True(t, ok, "Panels should exist")
		require.Len(t, panels, 4, "Should have Row A, Panel A, Row B, Panel B")

		// Row A at y=0
		rowA, ok := panels[0].(map[string]any)
		require.True(t, ok, "Row A should be a map")
		assert.Equal(t, "row", rowA["type"])
		rowAGridPos, ok := rowA["gridPos"].(map[string]any)
		require.True(t, ok, "Row A should have gridPos")
		assert.Equal(t, int64(0), getIntValue(rowAGridPos["y"]), "Row A should be at y=0")

		// Panel A at y=1 (directly below Row A at y=0)
		panelA, ok := panels[1].(map[string]any)
		require.True(t, ok, "Panel A should be a map")
		panelAGridPos, ok := panelA["gridPos"].(map[string]any)
		require.True(t, ok, "Panel A should have gridPos")
		assert.Equal(t, int64(1), getIntValue(panelAGridPos["y"]), "Panel A should be at y=1, below its row at y=0")

		// Row B at y=9 (after Panel A extent: y=1 + h=8 = 9)
		rowB, ok := panels[2].(map[string]any)
		require.True(t, ok, "Row B should be a map")
		rowBGridPos, ok := rowB["gridPos"].(map[string]any)
		require.True(t, ok, "Row B should have gridPos")
		assert.Equal(t, int64(9), getIntValue(rowBGridPos["y"]), "Row B should be at y=9, after Panel A")

		// Panel B at y=10 (directly below Row B at y=9)
		panelB, ok := panels[3].(map[string]any)
		require.True(t, ok, "Panel B should be a map")
		panelBGridPos, ok := panelB["gridPos"].(map[string]any)
		require.True(t, ok, "Panel B should have gridPos")
		assert.Equal(t, int64(10), getIntValue(panelBGridPos["y"]), "Panel B should be at y=10, below its row at y=9")
	})

	t.Run("empty expanded row advances Y past row panel", func(t *testing.T) {
		elements := map[string]dashv2alpha1.DashboardElement{
			"panel-1": makeElement("Panel A", 1),
		}

		v2alpha1 := dashv2alpha1.Dashboard{
			Spec: dashv2alpha1.DashboardSpec{
				Title:    "Test Dashboard",
				Elements: elements,
				Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
					RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
						Kind: "RowsLayout",
						Spec: dashv2alpha1.DashboardRowsLayoutSpec{
							Rows: []dashv2alpha1.DashboardRowsLayoutRowKind{
								{
									Kind: "RowsLayoutRow",
									Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
										Title: ptr.To("Empty Row"),
										Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
											AutoGridLayoutKind: &dashv2alpha1.DashboardAutoGridLayoutKind{
												Kind: "AutoGridLayout",
												Spec: dashv2alpha1.DashboardAutoGridLayoutSpec{
													RowHeightMode: dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeStandard,
													Items:         []dashv2alpha1.DashboardAutoGridLayoutItemKind{},
												},
											},
										},
									},
								},
								{
									Kind: "RowsLayoutRow",
									Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
										Title: ptr.To("Row With Panel"),
										Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
											AutoGridLayoutKind: &dashv2alpha1.DashboardAutoGridLayoutKind{
												Kind: "AutoGridLayout",
												Spec: dashv2alpha1.DashboardAutoGridLayoutSpec{
													RowHeightMode: dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeStandard,
													Items: []dashv2alpha1.DashboardAutoGridLayoutItemKind{
														{
															Kind: "AutoGridLayoutItem",
															Spec: dashv2alpha1.DashboardAutoGridLayoutItemSpec{
																Element: dashv2alpha1.DashboardElementReference{
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

		var v1beta1 dashv1.Dashboard
		err := scheme.Convert(&v2alpha1, &v1beta1, nil)
		require.NoError(t, err)

		dashboard := v1beta1.Spec.Object
		panels, ok := dashboard["panels"].([]any)
		require.True(t, ok, "Panels should exist")
		require.Len(t, panels, 3, "Should have Empty Row, Row With Panel, Panel A")

		// Empty Row at y=0
		emptyRow, ok := panels[0].(map[string]any)
		require.True(t, ok, "Empty row should be a map")
		emptyRowGridPos, ok := emptyRow["gridPos"].(map[string]any)
		require.True(t, ok, "Empty row should have gridPos")
		assert.Equal(t, int64(0), getIntValue(emptyRowGridPos["y"]), "Empty row should be at y=0")

		// Row With Panel at y=1 (directly below Empty Row at y=0)
		rowWithPanel, ok := panels[1].(map[string]any)
		require.True(t, ok, "Row with panel should be a map")
		rowGridPos, ok := rowWithPanel["gridPos"].(map[string]any)
		require.True(t, ok, "Row with panel should have gridPos")
		assert.Equal(t, int64(1), getIntValue(rowGridPos["y"]), "Row should be at y=1, after empty row at y=0")

		// Panel A at y=2 (below Row With Panel)
		panelA, ok := panels[2].(map[string]any)
		require.True(t, ok, "Panel A should be a map")
		panelAGridPos, ok := panelA["gridPos"].(map[string]any)
		require.True(t, ok, "Panel A should have gridPos")
		assert.Equal(t, int64(2), getIntValue(panelAGridPos["y"]), "Panel should be at y=2, below its row at y=1")
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

// TestV2alpha1ToV1BasicFields tests conversion of basic dashboard fields
func TestV2alpha1ToV1BasicFields(t *testing.T) {
	// Initialize the migrator with test data source and library element providers
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
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

	var v1 dashv1.Dashboard
	err = scheme.Convert(&v2alpha1, &v1, nil)
	require.NoError(t, err)

	// Verify the conversion - dashboard JSON is directly at Spec.Object level (no "dashboard" wrapper)
	dashboard := v1.Spec.Object

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

// TestV2alpha1ToV1MatcherConfig tests conversion of matcher scope/config (transformation filter and field override)
func TestV2alpha1ToV1MatcherConfig(t *testing.T) {
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	scopeSeries := dashv2alpha1.DashboardMatcherScopeSeries
	scopeNested := dashv2alpha1.DashboardMatcherScopeNested
	filterMatcher := &dashv2alpha1.DashboardMatcherConfig{
		Id:      "byName",
		Scope:   &scopeSeries,
		Options: map[string]interface{}{"include": ".*"},
	}

	v2alpha1 := dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Title: "Test Dashboard",
			Elements: map[string]dashv2alpha1.DashboardElement{
				"panel-with-matchers": {
					PanelKind: &dashv2alpha1.DashboardPanelKind{
						Kind: "Panel",
						Spec: dashv2alpha1.DashboardPanelSpec{
							Id:    1,
							Title: "Panel with matchers",
							Data: dashv2alpha1.DashboardQueryGroupKind{
								Kind: "QueryGroup",
								Spec: dashv2alpha1.DashboardQueryGroupSpec{
									Queries: []dashv2alpha1.DashboardPanelQueryKind{},
									Transformations: []dashv2alpha1.DashboardTransformationKind{
										{
											Kind: "filterByValue",
											Spec: dashv2alpha1.DashboardDataTransformerConfig{
												Id:      "filterByValue",
												Filter:  nil,
												Options: map[string]interface{}{},
											},
										},
										{
											Kind: "groupBy",
											Spec: dashv2alpha1.DashboardDataTransformerConfig{
												Id:      "groupBy",
												Filter:  filterMatcher,
												Options: map[string]interface{}{"include": ".*"},
											},
										},
									},
									QueryOptions: *dashv2alpha1.NewDashboardQueryOptionsSpec(),
								},
							},
							VizConfig: dashv2alpha1.DashboardVizConfigKind{
								Kind: "timeseries",
								Spec: dashv2alpha1.DashboardVizConfigSpec{
									PluginVersion: "1.0",
									Options:       map[string]interface{}{},
									FieldConfig: dashv2alpha1.DashboardFieldConfigSource{
										Defaults: *dashv2alpha1.NewDashboardFieldConfig(),
										Overrides: []dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides{
											{
												Matcher: dashv2alpha1.DashboardMatcherConfig{
													Id:      "byName",
													Scope:   &scopeNested,
													Options: map[string]interface{}{"name": "Field1"},
												},
												Properties: []dashv2alpha1.DashboardDynamicConfigValue{},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2alpha1.DashboardGridLayoutSpec{
						Items: []dashv2alpha1.DashboardGridLayoutItemKind{
							{
								Kind: "GridLayoutItem",
								Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
									X: 0, Y: 0, Width: 12, Height: 8,
									Element: dashv2alpha1.DashboardElementReference{
										Kind: "ElementReference",
										Name: "panel-with-matchers",
									},
								},
							},
						},
					},
				},
			},
		},
	}

	var v1 dashv1.Dashboard
	err = scheme.Convert(&v2alpha1, &v1, nil)
	require.NoError(t, err)

	dashboard := v1.Spec.Object

	// Find the panel (may be under panels[0] or in a row's panels depending on layout conversion)
	panels, ok := dashboard["panels"].([]interface{})
	require.True(t, ok, "panels should exist")
	require.NotEmpty(t, panels, "at least one panel expected")

	// Grid layout produces flat panels; get the panel with transformations
	var panel map[string]interface{}
	for _, p := range panels {
		pm, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		if _, hasTrans := pm["transformations"]; hasTrans {
			panel = pm
			break
		}
	}
	require.NotNil(t, panel, "panel with transformations should exist")

	// transformations may be []interface{} or []map[string]interface{} depending on conversion path
	transformationsRaw := panel["transformations"]
	require.NotNil(t, transformationsRaw, "transformations should exist")
	var trans1 map[string]interface{}
	switch tr := transformationsRaw.(type) {
	case []interface{}:
		require.Len(t, tr, 2)
		var ok bool
		trans1, ok = tr[1].(map[string]interface{})
		require.True(t, ok, "second transformation should be a map")
	case []map[string]interface{}:
		require.Len(t, tr, 2)
		trans1 = tr[1]
	default:
		t.Fatalf("transformations has unexpected type %T", transformationsRaw)
	}

	// Second transformation should have filter with scope "series"
	filter, ok := trans1["filter"].(map[string]interface{})
	require.True(t, ok, "second transformation should have filter")
	assert.Equal(t, "byName", filter["id"])
	assert.Equal(t, "series", filter["scope"])
	assert.Equal(t, map[string]interface{}{"include": ".*"}, filter["options"])

	// Field config overrides: matcher should have scope "nested"
	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	require.True(t, ok, "fieldConfig should exist")
	overridesRaw := fieldConfig["overrides"]
	require.NotNil(t, overridesRaw, "overrides should exist")
	var override0 map[string]interface{}
	switch ov := overridesRaw.(type) {
	case []interface{}:
		require.Len(t, ov, 1)
		var ok bool
		override0, ok = ov[0].(map[string]interface{})
		require.True(t, ok)
	case []map[string]interface{}:
		require.Len(t, ov, 1)
		override0 = ov[0]
	default:
		t.Fatalf("overrides has unexpected type %T", overridesRaw)
	}
	matcher, ok := override0["matcher"].(map[string]interface{})
	require.True(t, ok, "override should have matcher")
	assert.Equal(t, "byName", matcher["id"])
	assert.Equal(t, "nested", matcher["scope"])
	assert.Equal(t, map[string]interface{}{"name": "Field1"}, matcher["options"])
}

// TestV2beta1ToV1WriteOutputFiles writes output files from v2beta1 input files
// This test reads v2beta1 input files (including subdirectories), converts them to v1, and writes the output files
func TestV2beta1ToV1WriteOutputFiles(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	// Read all v2beta1 input files recursively
	inputDir := filepath.Join("testdata", "input")
	outputBaseDir := filepath.Join("testdata", "output")

	err := filepath.WalkDir(inputDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		// Only process v2beta1 input files
		if !strings.HasPrefix(d.Name(), "v2beta1.") || !strings.HasSuffix(d.Name(), ".json") {
			return nil
		}

		// Get relative path from input directory
		relPath, err := filepath.Rel(inputDir, path)
		if err != nil {
			return err
		}

		// Extract the base name (e.g., "v2beta1.complete" from "v2beta1.complete.json")
		baseName := strings.TrimSuffix(d.Name(), ".json")
		// The output file should be "v2beta1.complete.v1.json"
		outputFileName := baseName + ".v1.json"

		// Calculate output directory (preserve subdirectory structure)
		relDir := filepath.Dir(relPath)
		outputDir := outputBaseDir
		if relDir != "." {
			outputDir = filepath.Join(outputBaseDir, relDir)
		}

		t.Run(fmt.Sprintf("WriteOutput_%s", relPath), func(t *testing.T) {
			// Read the v2beta1 input file
			var v2beta1 dashv2beta1.Dashboard
			readInputFile(t, path, &v2beta1)

			// Convert v2beta1 → v1
			var convertedV1 dashv1.Dashboard
			err := scheme.Convert(&v2beta1, &convertedV1, nil)
			require.NoError(t, err, "Failed to convert v2beta1 to v1")

			// Write output file using the shared testConversion helper
			// dashv1.Dashboard implements metav1.Object, so we can use testConversion directly
			testConversion(t, &convertedV1, outputFileName, outputDir)
		})

		return nil
	})
	require.NoError(t, err, "Failed to walk input directory")
}

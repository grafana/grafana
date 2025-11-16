package conversion

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

func TestCountPanelsV0V1(t *testing.T) {
	tests := []struct {
		name     string
		spec     map[string]interface{}
		expected int
	}{
		{
			name:     "nil spec",
			spec:     nil,
			expected: 0,
		},
		{
			name:     "empty spec",
			spec:     map[string]interface{}{},
			expected: 0,
		},
		{
			name: "dashboard with 2 regular panels",
			spec: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
					},
					map[string]interface{}{
						"id":   float64(2),
						"type": "table",
					},
				},
			},
			expected: 2,
		},
		{
			name: "dashboard with row panel and collapsed panels",
			spec: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
					},
					map[string]interface{}{
						"id":   float64(2),
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id":   float64(3),
								"type": "graph",
							},
							map[string]interface{}{
								"id":   float64(4),
								"type": "table",
							},
						},
					},
				},
			},
			expected: 3, // 1 regular panel + 2 collapsed panels (row itself is not counted)
		},
		{
			name: "dashboard with only row panel (no collapsed panels)",
			spec: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "row",
					},
				},
			},
			expected: 0, // Row panels themselves are not counted
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count := countPanelsV0V1(tt.spec)
			assert.Equal(t, tt.expected, count)
		})
	}
}

func TestCountQueriesV0V1(t *testing.T) {
	tests := []struct {
		name     string
		spec     map[string]interface{}
		expected int
	}{
		{
			name:     "nil spec",
			spec:     nil,
			expected: 0,
		},
		{
			name: "panel with 2 queries",
			spec: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
							map[string]interface{}{"refId": "B"},
						},
					},
				},
			},
			expected: 2,
		},
		{
			name: "multiple panels with queries",
			spec: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
					map[string]interface{}{
						"id":   float64(2),
						"type": "table",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
							map[string]interface{}{"refId": "B"},
							map[string]interface{}{"refId": "C"},
						},
					},
				},
			},
			expected: 4,
		},
		{
			name: "queries in collapsed panels",
			spec: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id":   float64(2),
								"type": "graph",
								"targets": []interface{}{
									map[string]interface{}{"refId": "A"},
									map[string]interface{}{"refId": "B"},
								},
							},
						},
					},
				},
			},
			expected: 2,
		},
		{
			name: "row panel with queries (should be ignored)",
			spec: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
					map[string]interface{}{
						"id":   float64(2),
						"type": "row",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"}, // Invalid - row panels shouldn't have queries
							map[string]interface{}{"refId": "B"},
						},
					},
				},
			},
			expected: 1, // Only count the graph panel query, ignore row panel queries
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count := countQueriesV0V1(tt.spec)
			assert.Equal(t, tt.expected, count)
		})
	}
}

func TestCountAnnotationsV0V1(t *testing.T) {
	tests := []struct {
		name     string
		spec     map[string]interface{}
		expected int
	}{
		{
			name:     "nil spec",
			spec:     nil,
			expected: 0,
		},
		{
			name: "dashboard with 2 annotations",
			spec: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"name": "Annotation 1"},
						map[string]interface{}{"name": "Annotation 2"},
					},
				},
			},
			expected: 2,
		},
		{
			name: "dashboard with no annotations",
			spec: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{},
				},
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count := countAnnotationsV0V1(tt.spec)
			assert.Equal(t, tt.expected, count)
		})
	}
}

func TestCountLinksV0V1(t *testing.T) {
	tests := []struct {
		name     string
		spec     map[string]interface{}
		expected int
	}{
		{
			name:     "nil spec",
			spec:     nil,
			expected: 0,
		},
		{
			name: "dashboard with 3 links",
			spec: map[string]interface{}{
				"links": []interface{}{
					map[string]interface{}{"title": "Link 1"},
					map[string]interface{}{"title": "Link 2"},
					map[string]interface{}{"title": "Link 3"},
				},
			},
			expected: 3,
		},
		{
			name: "dashboard with no links",
			spec: map[string]interface{}{
				"links": []interface{}{},
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count := countLinksV0V1(tt.spec)
			assert.Equal(t, tt.expected, count)
		})
	}
}

func TestCountVariablesV0V1(t *testing.T) {
	tests := []struct {
		name     string
		spec     map[string]interface{}
		expected int
	}{
		{
			name:     "nil spec",
			spec:     nil,
			expected: 0,
		},
		{
			name:     "empty spec",
			spec:     map[string]interface{}{},
			expected: 0,
		},
		{
			name: "dashboard with 3 variables",
			spec: map[string]interface{}{
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"name": "var1", "type": "query"},
						map[string]interface{}{"name": "var2", "type": "custom"},
						map[string]interface{}{"name": "var3", "type": "datasource"},
					},
				},
			},
			expected: 3,
		},
		{
			name: "dashboard with no variables",
			spec: map[string]interface{}{
				"templating": map[string]interface{}{
					"list": []interface{}{},
				},
			},
			expected: 0,
		},
		{
			name: "dashboard without templating field",
			spec: map[string]interface{}{
				"title": "test",
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count := countVariablesV0V1(tt.spec)
			assert.Equal(t, tt.expected, count)
		})
	}
}

func TestCountPanelsV2(t *testing.T) {
	tests := []struct {
		name     string
		elements map[string]dashv2alpha1.DashboardElement
		expected int
	}{
		{
			name:     "empty elements",
			elements: map[string]dashv2alpha1.DashboardElement{},
			expected: 0,
		},
		{
			name: "2 regular panels",
			elements: map[string]dashv2alpha1.DashboardElement{
				"panel1": {
					PanelKind: &dashv2alpha1.DashboardPanelKind{
						Kind: "Panel",
						Spec: dashv2alpha1.DashboardPanelSpec{
							Id: 1,
						},
					},
				},
				"panel2": {
					PanelKind: &dashv2alpha1.DashboardPanelKind{
						Kind: "Panel",
						Spec: dashv2alpha1.DashboardPanelSpec{
							Id: 2,
						},
					},
				},
			},
			expected: 2,
		},
		{
			name: "1 panel and 1 library panel",
			elements: map[string]dashv2alpha1.DashboardElement{
				"panel1": {
					PanelKind: &dashv2alpha1.DashboardPanelKind{
						Kind: "Panel",
						Spec: dashv2alpha1.DashboardPanelSpec{
							Id: 1,
						},
					},
				},
				"libpanel1": {
					LibraryPanelKind: &dashv2alpha1.DashboardLibraryPanelKind{
						Kind: "LibraryPanel",
					},
				},
			},
			expected: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count := countPanelsV2(tt.elements)
			assert.Equal(t, tt.expected, count)
		})
	}
}

func TestDetectConversionDataLoss(t *testing.T) {
	tests := []struct {
		name        string
		sourceStats dashboardStats
		targetStats dashboardStats
		expectError bool
		errorMsg    string
	}{
		{
			name: "perfect match - no data loss",
			sourceStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
				variableCount:   2,
			},
			targetStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
				variableCount:   2,
			},
			expectError: false,
		},
		{
			name: "panel count decreased (data loss)",
			sourceStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
			},
			targetStats: dashboardStats{
				panelCount:      2, // Lost a panel!
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
			},
			expectError: true,
			errorMsg:    "panel count decreased",
		},
		{
			name: "panel count increased (allowed)",
			sourceStats: dashboardStats{
				panelCount:      2,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
			},
			targetStats: dashboardStats{
				panelCount:      3, // Added a panel (OK)
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
			},
			expectError: false,
		},
		{
			name: "query count decreased (data loss)",
			sourceStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
			},
			targetStats: dashboardStats{
				panelCount:      3,
				queryCount:      3, // Lost queries!
				annotationCount: 2,
				linkCount:       1,
			},
			expectError: true,
			errorMsg:    "query count decreased",
		},
		{
			name: "annotation count decreased (data loss)",
			sourceStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
			},
			targetStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 1, // Lost annotation!
				linkCount:       1,
			},
			expectError: true,
			errorMsg:    "annotation count decreased",
		},
		{
			name: "annotation count increased (allowed - default annotations)",
			sourceStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 0,
				linkCount:       1,
			},
			targetStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 1, // Added default annotation (OK)
				linkCount:       1,
			},
			expectError: false,
		},
		{
			name: "variable count decreased (data loss)",
			sourceStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
				variableCount:   3,
			},
			targetStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
				variableCount:   1, // Lost variables!
			},
			expectError: true,
			errorMsg:    "variable count decreased",
		},
		{
			name: "multiple decreases (data loss)",
			sourceStats: dashboardStats{
				panelCount:      3,
				queryCount:      5,
				annotationCount: 2,
				linkCount:       1,
				variableCount:   2,
			},
			targetStats: dashboardStats{
				panelCount:      2, // Lost panel
				queryCount:      3, // Lost queries
				annotationCount: 2,
				linkCount:       0, // Lost link
				variableCount:   2,
			},
			expectError: true,
			errorMsg:    "panel count decreased",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := detectConversionDataLoss(tt.sourceStats, tt.targetStats, "TestSource", "TestTarget")
			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)

				// Check if it's a ConversionDataLossError
				var detectConversionDataLossErr *ConversionDataLossError
				require.ErrorAs(t, err, &detectConversionDataLossErr)
				assert.Equal(t, "TestSource_to_TestTarget", detectConversionDataLossErr.GetFunctionName())
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCollectStatsV0V1(t *testing.T) {
	spec := map[string]interface{}{
		"panels": []interface{}{
			map[string]interface{}{
				"id":   float64(1),
				"type": "graph",
				"targets": []interface{}{
					map[string]interface{}{"refId": "A"},
					map[string]interface{}{"refId": "B"},
				},
			},
			map[string]interface{}{
				"id":   float64(2),
				"type": "table",
				"targets": []interface{}{
					map[string]interface{}{"refId": "A"},
				},
			},
		},
		"annotations": map[string]interface{}{
			"list": []interface{}{
				map[string]interface{}{"name": "Annotation 1"},
			},
		},
		"links": []interface{}{
			map[string]interface{}{"title": "Link 1"},
			map[string]interface{}{"title": "Link 2"},
		},
		"templating": map[string]interface{}{
			"list": []interface{}{
				map[string]interface{}{"name": "var1", "type": "query"},
				map[string]interface{}{"name": "var2", "type": "custom"},
			},
		},
	}

	stats := collectStatsV0V1(spec)

	assert.Equal(t, 2, stats.panelCount)
	assert.Equal(t, 3, stats.queryCount)
	assert.Equal(t, 1, stats.annotationCount)
	assert.Equal(t, 2, stats.linkCount)
	assert.Equal(t, 2, stats.variableCount)
}

func TestCollectStatsV2alpha1(t *testing.T) {
	spec := dashv2alpha1.DashboardSpec{
		Elements: map[string]dashv2alpha1.DashboardElement{
			"panel1": {
				PanelKind: &dashv2alpha1.DashboardPanelKind{
					Kind: "Panel",
					Spec: dashv2alpha1.DashboardPanelSpec{
						Id: 1,
						Data: dashv2alpha1.DashboardQueryGroupKind{
							Spec: dashv2alpha1.DashboardQueryGroupSpec{
								Queries: []dashv2alpha1.DashboardPanelQueryKind{
									{},
									{},
								},
							},
						},
					},
				},
			},
			"panel2": {
				PanelKind: &dashv2alpha1.DashboardPanelKind{
					Kind: "Panel",
					Spec: dashv2alpha1.DashboardPanelSpec{
						Id: 2,
						Data: dashv2alpha1.DashboardQueryGroupKind{
							Spec: dashv2alpha1.DashboardQueryGroupSpec{
								Queries: []dashv2alpha1.DashboardPanelQueryKind{
									{},
								},
							},
						},
					},
				},
			},
		},
		Annotations: []dashv2alpha1.DashboardAnnotationQueryKind{
			{},
		},
		Links: []dashv2alpha1.DashboardDashboardLink{
			{},
			{},
		},
		Variables: []dashv2alpha1.DashboardVariableKind{
			{},
			{},
		},
	}

	stats := collectStatsV2alpha1(spec)

	assert.Equal(t, 2, stats.panelCount)
	assert.Equal(t, 3, stats.queryCount)
	assert.Equal(t, 1, stats.annotationCount)
	assert.Equal(t, 2, stats.linkCount)
	assert.Equal(t, 2, stats.variableCount)
}

func TestConversionDataLossError(t *testing.T) {
	err := NewConversionDataLossError("TestFunc", "test error message", "v0alpha1", "v1beta1")

	assert.Equal(t, "TestFunc", err.GetFunctionName())
	assert.Equal(t, "v0alpha1", err.GetSourceAPIVersion())
	assert.Equal(t, "v1beta1", err.GetTargetAPIVersion())
	assert.Equal(t, "data loss detected in TestFunc (v0alpha1 → v1beta1): test error message", err.Error())
}

// Integration test showing how validation works with actual dashboard types
func TestWithConversionValidation_Integration(t *testing.T) {
	// Create a source dashboard (v0) with specific counts
	sourceV0 := &dashv0.Dashboard{
		Spec: dashv0.DashboardSpec{
			Object: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
					map[string]interface{}{
						"id":   float64(2),
						"type": "table",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
							map[string]interface{}{"refId": "B"},
						},
					},
				},
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"name": "Annotation 1"},
					},
				},
				"links": []interface{}{
					map[string]interface{}{"title": "Link 1"},
				},
			},
		},
	}

	// Create a target dashboard (v1) with matching counts
	targetV1 := &dashv1.Dashboard{
		Spec: dashv1.DashboardSpec{
			Object: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
					map[string]interface{}{
						"id":   float64(2),
						"type": "table",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
							map[string]interface{}{"refId": "B"},
						},
					},
				},
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"name": "Annotation 1"},
					},
				},
				"links": []interface{}{
					map[string]interface{}{"title": "Link 1"},
				},
			},
		},
	}

	// Mock conversion function that just copies the spec
	mockConversion := func(a, b interface{}, scope conversion.Scope) error {
		source := a.(*dashv0.Dashboard)
		target := b.(*dashv1.Dashboard)
		target.Spec = dashv1.DashboardSpec{Object: source.Spec.Object}
		return nil
	}

	// Wrap with validation
	validatedFunc := withConversionDataLossDetection("V0", "V1beta1", mockConversion)

	// This should pass validation
	err := validatedFunc(sourceV0, targetV1, nil)
	assert.NoError(t, err)
}

func TestWithConversionValidation_DataLoss(t *testing.T) {
	// Create a source dashboard (v0) with 2 panels
	sourceV0 := &dashv0.Dashboard{
		Spec: dashv0.DashboardSpec{
			Object: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
					},
					map[string]interface{}{
						"id":   float64(2),
						"type": "table",
					},
				},
			},
		},
	}

	targetV1 := &dashv1.Dashboard{}

	// Mock conversion function that loses a panel
	mockBadConversion := func(a, b interface{}, scope conversion.Scope) error {
		target := b.(*dashv1.Dashboard)
		// Only copy 1 panel instead of 2
		target.Spec = dashv1.DashboardSpec{
			Object: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   float64(1),
						"type": "graph",
					},
					// Missing panel 2!
				},
			},
		}
		return nil
	}

	// Wrap with data loss detection
	validatedFunc := withConversionDataLossDetection("V0", "V1beta1", mockBadConversion)

	// This should fail due to data loss
	err := validatedFunc(sourceV0, targetV1, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "panel count decreased")

	var detectConversionDataLossErr *ConversionDataLossError
	require.ErrorAs(t, err, &detectConversionDataLossErr)
	assert.Equal(t, "V0_to_V1beta1", detectConversionDataLossErr.GetFunctionName())
}

// TestDataLossDetectionOnAllInputFiles tests all conversions from testdata/input
// and logs detailed information about missing panels when data loss is detected
func TestDataLossDetectionOnAllInputFiles(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := testutil.NewDataSourceProvider(testutil.StandardTestConfig)
	libPanelProvider := testutil.NewFakeLibraryPanelProvider()
	migration.Initialize(dsProvider, libPanelProvider)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, libPanelProvider)
	require.NoError(t, err)

	// Read all files from input directory
	files, err := os.ReadDir(filepath.Join("testdata", "input"))
	require.NoError(t, err, "Failed to read input directory")

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		t.Run(file.Name(), func(t *testing.T) {
			// Read input dashboard file
			inputFile := filepath.Join("testdata", "input", file.Name())
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			inputData, err := os.ReadFile(inputFile)
			require.NoError(t, err, "Failed to read input file")

			// Parse the input dashboard to get its version
			var rawDash map[string]interface{}
			err = json.Unmarshal(inputData, &rawDash)
			require.NoError(t, err, "Failed to unmarshal dashboard JSON")

			// Extract apiVersion
			apiVersion, ok := rawDash["apiVersion"].(string)
			require.True(t, ok, "apiVersion not found or not a string")

			// Parse group and version from apiVersion
			gv, err := schema.ParseGroupVersion(apiVersion)
			require.NoError(t, err)

			// Create source object based on version
			var sourceDash runtime.Object
			var sourceStats dashboardStats

			switch gv.Version {
			case "v0alpha1":
				var dash dashv0.Dashboard
				err = json.Unmarshal(inputData, &dash)
				require.NoError(t, err)
				sourceDash = &dash
				if dash.Spec.Object != nil {
					sourceStats = collectStatsV0V1(dash.Spec.Object)
				}
			case "v1beta1":
				var dash dashv1.Dashboard
				err = json.Unmarshal(inputData, &dash)
				require.NoError(t, err)
				sourceDash = &dash
				if dash.Spec.Object != nil {
					sourceStats = collectStatsV0V1(dash.Spec.Object)
				}
			case "v2alpha1":
				var dash dashv2alpha1.Dashboard
				err = json.Unmarshal(inputData, &dash)
				require.NoError(t, err)
				sourceDash = &dash
				sourceStats = collectStatsV2alpha1(dash.Spec)
			case "v2beta1":
				var dash dashv2beta1.Dashboard
				err = json.Unmarshal(inputData, &dash)
				require.NoError(t, err)
				sourceDash = &dash
				sourceStats = collectStatsV2beta1(dash.Spec)
			default:
				t.Fatalf("Unsupported source version: %s", gv.Version)
			}

			// Get target versions from the dashboard manifest
			manifest := apis.LocalManifest()

			// Get all Dashboard versions from the manifest
			for _, kind := range manifest.ManifestData.Kinds() {
				if kind.Kind == "Dashboard" {
					for _, version := range kind.Versions {
						// Skip converting to the same version
						if version.VersionName == gv.Version {
							continue
						}

						targetVersion := version.VersionName
						t.Run(fmt.Sprintf("to_%s", targetVersion), func(t *testing.T) {
							// Create target object
							var target runtime.Object
							typeMeta := metav1.TypeMeta{
								APIVersion: fmt.Sprintf("%s/%s", dashv0.APIGroup, targetVersion),
								Kind:       "Dashboard",
							}

							switch targetVersion {
							case "v0alpha1":
								target = &dashv0.Dashboard{TypeMeta: typeMeta}
							case "v1beta1":
								target = &dashv1.Dashboard{TypeMeta: typeMeta}
							case "v2alpha1":
								target = &dashv2alpha1.Dashboard{TypeMeta: typeMeta}
							case "v2beta1":
								target = &dashv2beta1.Dashboard{TypeMeta: typeMeta}
							default:
								t.Skipf("Unknown version %s", targetVersion)
								return
							}

							// Create a copy of the source for conversion
							inputCopy := sourceDash.DeepCopyObject()

							// Convert to target version
							err := scheme.Convert(inputCopy, target, nil)

							// Check if data loss was detected
							var dataLossErr *ConversionDataLossError
							if err != nil && errors.As(err, &dataLossErr) {
								// Collect target stats
								var targetStats dashboardStats
								switch tgt := target.(type) {
								case *dashv0.Dashboard:
									if tgt.Spec.Object != nil {
										targetStats = collectStatsV0V1(tgt.Spec.Object)
									}
								case *dashv1.Dashboard:
									if tgt.Spec.Object != nil {
										targetStats = collectStatsV0V1(tgt.Spec.Object)
									}
								case *dashv2alpha1.Dashboard:
									targetStats = collectStatsV2alpha1(tgt.Spec)
								case *dashv2beta1.Dashboard:
									targetStats = collectStatsV2beta1(tgt.Spec)
								}

								// Log detailed information about the data loss
								t.Logf("🔍 DATA LOSS DETECTED: %s → %s", gv.Version, targetVersion)
								t.Logf("   File: %s", file.Name())
								t.Logf("   Error: %s", err.Error())
								t.Logf("")
								t.Logf("   📊 Statistics:")
								t.Logf("      Panels:      %d → %d (Δ %d)", sourceStats.panelCount, targetStats.panelCount, targetStats.panelCount-sourceStats.panelCount)
								t.Logf("      Queries:     %d → %d (Δ %d)", sourceStats.queryCount, targetStats.queryCount, targetStats.queryCount-sourceStats.queryCount)
								t.Logf("      Annotations: %d → %d (Δ %d)", sourceStats.annotationCount, targetStats.annotationCount, targetStats.annotationCount-sourceStats.annotationCount)
								t.Logf("      Links:       %d → %d (Δ %d)", sourceStats.linkCount, targetStats.linkCount, targetStats.linkCount-sourceStats.linkCount)
								t.Logf("")

								// Log panel details if panels were lost
								if targetStats.panelCount < sourceStats.panelCount {
									t.Logf("   📋 Panel Analysis:")
									logMissingPanels(t, sourceDash, target, gv.Version, targetVersion)
								}

								// Log query details if queries were lost
								if targetStats.queryCount < sourceStats.queryCount {
									t.Logf("   🔍 Query Analysis:")
									logMissingQueries(t, sourceDash, target, gv.Version, targetVersion)
								}

								// Expected data loss for V2 → V0/V1 conversions (not yet implemented)
								if strings.HasPrefix(gv.Version, "v2") && (targetVersion == "v0alpha1" || targetVersion == "v1beta1") {
									t.Logf("   ℹ️  Note: V2 → %s conversions are not yet fully implemented - data loss is expected", targetVersion)
									t.Skip("Skipping: V2 downgrade conversions not yet implemented")
								} else {
									// For other conversions, data loss is a real bug
									t.Errorf("Unexpected data loss in %s → %s conversion", gv.Version, targetVersion)
								}
							}
						})
					}
					break
				}
			}
		})
	}
}

// logMissingPanels logs details about panels that were lost during conversion
func logMissingPanels(t *testing.T, source, target runtime.Object, sourceVersion, targetVersion string) {
	t.Helper()

	// Extract source panels
	var sourcePanelIDs []float64
	var sourcePanelTypes []string

	switch src := source.(type) {
	case *dashv0.Dashboard:
		if src.Spec.Object != nil {
			sourcePanelIDs, sourcePanelTypes = extractPanelInfoV0V1(src.Spec.Object)
		}
	case *dashv1.Dashboard:
		if src.Spec.Object != nil {
			sourcePanelIDs, sourcePanelTypes = extractPanelInfoV0V1(src.Spec.Object)
		}
	case *dashv2alpha1.Dashboard:
		sourcePanelIDs, sourcePanelTypes = extractPanelInfoV2alpha1(src.Spec)
	case *dashv2beta1.Dashboard:
		sourcePanelIDs, sourcePanelTypes = extractPanelInfoV2beta1(src.Spec)
	}

	// Extract target panels
	var targetPanelIDs []float64
	var targetPanelTypes []string

	switch tgt := target.(type) {
	case *dashv0.Dashboard:
		if tgt.Spec.Object != nil {
			targetPanelIDs, targetPanelTypes = extractPanelInfoV0V1(tgt.Spec.Object)
		}
	case *dashv1.Dashboard:
		if tgt.Spec.Object != nil {
			targetPanelIDs, targetPanelTypes = extractPanelInfoV0V1(tgt.Spec.Object)
		}
	case *dashv2alpha1.Dashboard:
		targetPanelIDs, targetPanelTypes = extractPanelInfoV2alpha1(tgt.Spec)
	case *dashv2beta1.Dashboard:
		targetPanelIDs, targetPanelTypes = extractPanelInfoV2beta1(tgt.Spec)
	}

	// Create maps for quick lookup
	targetIDMap := make(map[float64]bool)
	for _, id := range targetPanelIDs {
		targetIDMap[id] = true
	}

	// Find missing panels
	t.Logf("      Source panels (%s) - %d total:", sourceVersion, len(sourcePanelIDs))
	for i, id := range sourcePanelIDs {
		panelType := ""
		if i < len(sourcePanelTypes) {
			panelType = sourcePanelTypes[i]
		}
		status := "✓"
		if !targetIDMap[id] {
			status = "✗ MISSING"
		}
		t.Logf("         %s Panel ID %.0f (type: %s)", status, id, panelType)
	}

	t.Logf("      Target panels (%s) - %d total:", targetVersion, len(targetPanelIDs))
	for i, id := range targetPanelIDs {
		panelType := ""
		if i < len(targetPanelTypes) {
			panelType = targetPanelTypes[i]
		}
		t.Logf("         Panel ID %.0f (type: %s)", id, panelType)
	}
}

// logMissingQueries logs details about queries that were lost during conversion
func logMissingQueries(t *testing.T, source, target runtime.Object, sourceVersion, targetVersion string) {
	t.Helper()

	// Extract source query info
	var sourceQueryInfo []queryInfo

	switch src := source.(type) {
	case *dashv0.Dashboard:
		if src.Spec.Object != nil {
			sourceQueryInfo = extractQueryInfoV0V1(src.Spec.Object)
		}
	case *dashv1.Dashboard:
		if src.Spec.Object != nil {
			sourceQueryInfo = extractQueryInfoV0V1(src.Spec.Object)
		}
	case *dashv2alpha1.Dashboard:
		sourceQueryInfo = extractQueryInfoV2alpha1(src.Spec)
	case *dashv2beta1.Dashboard:
		sourceQueryInfo = extractQueryInfoV2beta1(src.Spec)
	}

	// Extract target query info
	var targetQueryInfo []queryInfo

	switch tgt := target.(type) {
	case *dashv0.Dashboard:
		if tgt.Spec.Object != nil {
			targetQueryInfo = extractQueryInfoV0V1(tgt.Spec.Object)
		}
	case *dashv1.Dashboard:
		if tgt.Spec.Object != nil {
			targetQueryInfo = extractQueryInfoV0V1(tgt.Spec.Object)
		}
	case *dashv2alpha1.Dashboard:
		targetQueryInfo = extractQueryInfoV2alpha1(tgt.Spec)
	case *dashv2beta1.Dashboard:
		targetQueryInfo = extractQueryInfoV2beta1(tgt.Spec)
	}

	t.Logf("      Source queries (%s) - %d total:", sourceVersion, len(sourceQueryInfo))
	for _, q := range sourceQueryInfo {
		t.Logf("         Panel %.0f: %s (refId: %s)", q.panelID, q.datasourceType, q.refID)
	}

	t.Logf("      Target queries (%s) - %d total:", targetVersion, len(targetQueryInfo))
	for _, q := range targetQueryInfo {
		t.Logf("         Panel %.0f: %s (refId: %s)", q.panelID, q.datasourceType, q.refID)
	}

	// Identify missing queries by comparing refIds per panel
	missingCount := 0
	for _, srcQuery := range sourceQueryInfo {
		found := false
		for _, tgtQuery := range targetQueryInfo {
			if srcQuery.panelID == tgtQuery.panelID && srcQuery.refID == tgtQuery.refID {
				found = true
				break
			}
		}
		if !found {
			if missingCount == 0 {
				t.Logf("")
				t.Logf("      ✗ Missing queries in %s → %s conversion:", sourceVersion, targetVersion)
			}
			t.Logf("         Panel %.0f: refId=%s, datasource=%s", srcQuery.panelID, srcQuery.refID, srcQuery.datasourceType)
			missingCount++
		}
	}
}

// queryInfo contains information about a query for comparison
type queryInfo struct {
	panelID        float64
	refID          string
	datasourceType string
}

// extractPanelInfoV0V1 extracts panel IDs and types from v0/v1 dashboards
func extractPanelInfoV0V1(spec map[string]interface{}) ([]float64, []string) {
	if spec == nil {
		return nil, nil
	}

	panels, ok := spec["panels"].([]interface{})
	if !ok {
		return nil, nil
	}

	var ids []float64
	var types []string

	for _, p := range panels {
		panelMap, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		panelType, _ := panelMap["type"].(string)

		// Skip row panels, but process their collapsed panels
		if panelType == "row" {
			if collapsedPanels, ok := panelMap["panels"].([]interface{}); ok {
				for _, cp := range collapsedPanels {
					if cpMap, ok := cp.(map[string]interface{}); ok {
						if id, ok := cpMap["id"].(float64); ok {
							ids = append(ids, id)
							cpType, _ := cpMap["type"].(string)
							types = append(types, cpType)
						}
					}
				}
			}
		} else {
			// Regular panel
			if id, ok := panelMap["id"].(float64); ok {
				ids = append(ids, id)
				types = append(types, panelType)
			}
		}
	}

	return ids, types
}

// extractPanelInfoV2alpha1 extracts panel IDs and types from v2alpha1 dashboards
func extractPanelInfoV2alpha1(spec dashv2alpha1.DashboardSpec) ([]float64, []string) {
	var ids []float64
	var types []string

	for _, element := range spec.Elements {
		if element.PanelKind != nil {
			ids = append(ids, element.PanelKind.Spec.Id)
			types = append(types, element.PanelKind.Spec.VizConfig.Kind)
		} else if element.LibraryPanelKind != nil {
			ids = append(ids, element.LibraryPanelKind.Spec.Id)
			types = append(types, "LibraryPanel")
		}
	}

	return ids, types
}

// extractPanelInfoV2beta1 extracts panel IDs and types from v2beta1 dashboards
func extractPanelInfoV2beta1(spec dashv2beta1.DashboardSpec) ([]float64, []string) {
	var ids []float64
	var types []string

	for _, element := range spec.Elements {
		if element.PanelKind != nil {
			ids = append(ids, element.PanelKind.Spec.Id)
			types = append(types, element.PanelKind.Spec.VizConfig.Kind)
		} else if element.LibraryPanelKind != nil {
			ids = append(ids, element.LibraryPanelKind.Spec.Id)
			types = append(types, "LibraryPanel")
		}
	}

	return ids, types
}

// extractQueryInfoV0V1 extracts query information from v0/v1 dashboards
// Note: Row panels should not have queries - we ignore queries on row panels themselves
func extractQueryInfoV0V1(spec map[string]interface{}) []queryInfo {
	if spec == nil {
		return nil
	}

	panels, ok := spec["panels"].([]interface{})
	if !ok {
		return nil
	}

	var queries []queryInfo

	for _, p := range panels {
		panelMap, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		panelID, _ := panelMap["id"].(float64)
		panelType, _ := panelMap["type"].(string)

		// Process regular panel queries (NOT row panels)
		// Row panels are layout containers and should not have queries
		if panelType != "row" {
			if targets, ok := panelMap["targets"].([]interface{}); ok {
				for _, target := range targets {
					if targetMap, ok := target.(map[string]interface{}); ok {
						refID, _ := targetMap["refId"].(string)
						dsType := ""
						if ds, ok := targetMap["datasource"].(map[string]interface{}); ok {
							dsType, _ = ds["type"].(string)
						}
						queries = append(queries, queryInfo{
							panelID:        panelID,
							refID:          refID,
							datasourceType: dsType,
						})
					}
				}
			}
		}

		// Process queries in collapsed panels inside row panels
		if panelType == "row" {
			// Note: We ignore any queries on the row panel itself (panelMap["targets"])
			// and only process queries in the collapsed panels
			if collapsedPanels, ok := panelMap["panels"].([]interface{}); ok {
				for _, cp := range collapsedPanels {
					if cpMap, ok := cp.(map[string]interface{}); ok {
						cpID, _ := cpMap["id"].(float64)
						if targets, ok := cpMap["targets"].([]interface{}); ok {
							for _, target := range targets {
								if targetMap, ok := target.(map[string]interface{}); ok {
									refID, _ := targetMap["refId"].(string)
									dsType := ""
									if ds, ok := targetMap["datasource"].(map[string]interface{}); ok {
										dsType, _ = ds["type"].(string)
									}
									queries = append(queries, queryInfo{
										panelID:        cpID,
										refID:          refID,
										datasourceType: dsType,
									})
								}
							}
						}
					}
				}
			}
		}
	}

	return queries
}

// extractQueryInfoV2alpha1 extracts query information from v2alpha1 dashboards
func extractQueryInfoV2alpha1(spec dashv2alpha1.DashboardSpec) []queryInfo {
	var queries []queryInfo

	for _, element := range spec.Elements {
		if element.PanelKind != nil {
			panelID := element.PanelKind.Spec.Id
			for _, query := range element.PanelKind.Spec.Data.Spec.Queries {
				refID := query.Spec.RefId
				dsType := query.Kind
				queries = append(queries, queryInfo{
					panelID:        panelID,
					refID:          refID,
					datasourceType: dsType,
				})
			}
		}
	}

	return queries
}

// extractQueryInfoV2beta1 extracts query information from v2beta1 dashboards
func extractQueryInfoV2beta1(spec dashv2beta1.DashboardSpec) []queryInfo {
	var queries []queryInfo

	for _, element := range spec.Elements {
		if element.PanelKind != nil {
			panelID := element.PanelKind.Spec.Id
			for _, query := range element.PanelKind.Spec.Data.Spec.Queries {
				refID := query.Spec.RefId
				dsType := query.Kind
				queries = append(queries, queryInfo{
					panelID:        panelID,
					refID:          refID,
					datasourceType: dsType,
				})
			}
		}
	}

	return queries
}

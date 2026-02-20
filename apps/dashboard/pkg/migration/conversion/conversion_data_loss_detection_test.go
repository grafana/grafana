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
	// Tests that expect NO error (no data loss)
	t.Run("success cases", func(t *testing.T) {
		successTests := []struct {
			name        string
			sourceStats dashboardStats
			targetStats dashboardStats
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
			},
		}

		for _, tt := range successTests {
			t.Run(tt.name, func(t *testing.T) {
				err := detectConversionDataLoss(tt.sourceStats, tt.targetStats, "TestSource", "TestTarget")
				assert.NoError(t, err)
			})
		}
	})

	// Tests that expect an error (data loss detected)
	t.Run("data loss cases", func(t *testing.T) {
		errorTests := []struct {
			name        string
			sourceStats dashboardStats
			targetStats dashboardStats
			errorMsg    string
		}{
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
				errorMsg: "panel count decreased",
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
				errorMsg: "query count decreased",
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
				errorMsg: "annotation count decreased",
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
				errorMsg: "variable count decreased",
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
				errorMsg: "panel count decreased",
			},
		}

		for _, tt := range errorTests {
			t.Run(tt.name, func(t *testing.T) {
				err := detectConversionDataLoss(tt.sourceStats, tt.targetStats, "TestSource", "TestTarget")
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)

				// Check if it's a ConversionDataLossError
				var detectConversionDataLossErr *ConversionDataLossError
				require.ErrorAs(t, err, &detectConversionDataLossErr)
				assert.Equal(t, "TestSource_to_TestTarget", detectConversionDataLossErr.GetFunctionName())
			})
		}
	})
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

// TestWithConversionMetrics_DataLossOnlyCheckedOnSuccess verifies that the
// withConversionMetrics wrapper only runs data loss detection when conversion succeeds.
func TestWithConversionMetrics_DataLossOnlyCheckedOnSuccess(t *testing.T) {
	conversionError := errors.New("conversion failed")

	// Test 1: Conversion fails - data loss should NOT be checked
	t.Run("data loss not checked when conversion fails", func(t *testing.T) {
		mockFailingConversion := func(a, b interface{}, scope conversion.Scope) error {
			return conversionError
		}

		wrappedFunc := withConversionMetrics(dashv0.APIVERSION, dashv1.APIVERSION, mockFailingConversion)

		sourceV0 := &dashv0.Dashboard{
			Spec: dashv0.DashboardSpec{
				Object: map[string]interface{}{
					"panels": []interface{}{
						map[string]interface{}{"id": float64(1), "type": "graph"},
						map[string]interface{}{"id": float64(2), "type": "table"},
					},
				},
			},
		}
		targetV1 := &dashv1.Dashboard{} // Empty - would trigger data loss if checked

		// Execute - withConversionMetrics always returns nil to avoid 500s
		err := wrappedFunc(sourceV0, targetV1, nil)
		require.NoError(t, err, "withConversionMetrics should return nil even on conversion failure")
	})

	// Test 2: Conversion succeeds but data loss occurs - should detect data loss
	t.Run("data loss detected when conversion succeeds but loses data", func(t *testing.T) {
		mockDataLosingConversion := func(a, b interface{}, scope conversion.Scope) error {
			// Conversion "succeeds" but loses a panel
			target := b.(*dashv1.Dashboard)
			target.Spec = dashv1.DashboardSpec{
				Object: map[string]interface{}{
					"panels": []interface{}{
						// Only 1 panel instead of 2
						map[string]interface{}{"id": float64(1), "type": "graph"},
					},
				},
			}
			return nil
		}

		wrappedFunc := withConversionMetrics(dashv0.APIVERSION, dashv1.APIVERSION, mockDataLosingConversion)

		sourceV0 := &dashv0.Dashboard{
			Spec: dashv0.DashboardSpec{
				Object: map[string]interface{}{
					"panels": []interface{}{
						map[string]interface{}{"id": float64(1), "type": "graph"},
						map[string]interface{}{"id": float64(2), "type": "table"},
					},
				},
			},
		}
		targetV1 := &dashv1.Dashboard{}

		// Execute - withConversionMetrics always returns nil
		err := wrappedFunc(sourceV0, targetV1, nil)
		require.NoError(t, err, "withConversionMetrics should return nil even on data loss")

		// The data loss is logged and recorded in metrics, but no error is returned to API server
	})
}

// TestDataLossDetectionReturnsCorrectError verifies that when data loss is detected,
// a ConversionDataLossError is returned with proper function name and details.
func TestDataLossDetectionReturnsCorrectError(t *testing.T) {
	t.Run("panel loss returns ConversionDataLossError", func(t *testing.T) {
		sourceV0 := &dashv0.Dashboard{
			Spec: dashv0.DashboardSpec{
				Object: map[string]interface{}{
					"panels": []interface{}{
						map[string]interface{}{"id": float64(1), "type": "graph"},
						map[string]interface{}{"id": float64(2), "type": "table"},
					},
				},
			},
		}

		targetV1 := &dashv1.Dashboard{
			Spec: dashv1.DashboardSpec{
				Object: map[string]interface{}{
					"panels": []interface{}{
						// Missing panel 2
						map[string]interface{}{"id": float64(1), "type": "graph"},
					},
				},
			},
		}

		err := checkConversionDataLoss(dashv0.APIVERSION, dashv1.APIVERSION, sourceV0, targetV1)

		require.Error(t, err)
		var dataLossErr *ConversionDataLossError
		require.ErrorAs(t, err, &dataLossErr)
		assert.Equal(t, "V0_to_V1", dataLossErr.GetFunctionName())
		assert.Contains(t, err.Error(), "panel count decreased")
	})

	t.Run("query loss returns ConversionDataLossError", func(t *testing.T) {
		sourceV0 := &dashv0.Dashboard{
			Spec: dashv0.DashboardSpec{
				Object: map[string]interface{}{
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
			},
		}

		targetV1 := &dashv1.Dashboard{
			Spec: dashv1.DashboardSpec{
				Object: map[string]interface{}{
					"panels": []interface{}{
						map[string]interface{}{
							"id":   float64(1),
							"type": "graph",
							"targets": []interface{}{
								// Missing query B
								map[string]interface{}{"refId": "A"},
							},
						},
					},
				},
			},
		}

		err := checkConversionDataLoss(dashv0.APIVERSION, dashv1.APIVERSION, sourceV0, targetV1)

		require.Error(t, err)
		var dataLossErr *ConversionDataLossError
		require.ErrorAs(t, err, &dataLossErr)
		assert.Contains(t, err.Error(), "query count decreased")
	})

	t.Run("no data loss returns nil", func(t *testing.T) {
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
					},
				},
			},
		}

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
					},
				},
			},
		}

		err := checkConversionDataLoss(dashv0.APIVERSION, dashv1.APIVERSION, sourceV0, targetV1)

		require.NoError(t, err)
	})
}

// TestDataLossDetection_AllTypesAllVersions verifies that data loss is detected for
// all types of loss (panels, queries, annotations, links, variables) across all
// version permutations (v0alpha1, v1beta1, v2alpha1, v2beta1).
func TestDataLossDetection_AllTypesAllVersions(t *testing.T) {
	// Helper to create v0/v1 unstructured spec with data
	createV0V1SpecWithData := func() map[string]interface{} {
		return map[string]interface{}{
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
						map[string]interface{}{"refId": "C"},
					},
				},
			},
			"annotations": map[string]interface{}{
				"list": []interface{}{
					map[string]interface{}{"name": "Annotation 1"},
					map[string]interface{}{"name": "Annotation 2"},
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
	}

	// Helper to create v0/v1 unstructured spec with data loss (missing items)
	createV0V1SpecWithLoss := func(lossType string) map[string]interface{} {
		spec := createV0V1SpecWithData()
		switch lossType {
		case "panel":
			spec["panels"] = []interface{}{
				map[string]interface{}{
					"id":   float64(1),
					"type": "graph",
					"targets": []interface{}{
						map[string]interface{}{"refId": "A"},
						map[string]interface{}{"refId": "B"},
					},
				},
				// Missing panel 2
			}
		case "query":
			spec["panels"] = []interface{}{
				map[string]interface{}{
					"id":   float64(1),
					"type": "graph",
					"targets": []interface{}{
						map[string]interface{}{"refId": "A"},
						// Missing query B
					},
				},
				map[string]interface{}{
					"id":   float64(2),
					"type": "table",
					"targets": []interface{}{
						map[string]interface{}{"refId": "C"},
					},
				},
			}
		case "annotation":
			spec["annotations"] = map[string]interface{}{
				"list": []interface{}{
					map[string]interface{}{"name": "Annotation 1"},
					// Missing annotation 2
				},
			}
		case "link":
			spec["links"] = []interface{}{
				map[string]interface{}{"title": "Link 1"},
				// Missing link 2
			}
		case "variable":
			spec["templating"] = map[string]interface{}{
				"list": []interface{}{
					map[string]interface{}{"name": "var1", "type": "query"},
					// Missing var2
				},
			}
		}
		return spec
	}

	// Helper to create v2alpha1 dashboard with data
	createV2alpha1WithData := func() *dashv2alpha1.Dashboard {
		return &dashv2alpha1.Dashboard{
			Spec: dashv2alpha1.DashboardSpec{
				Elements: map[string]dashv2alpha1.DashboardElement{
					"panel1": {
						PanelKind: &dashv2alpha1.DashboardPanelKind{
							Kind: "Panel",
							Spec: dashv2alpha1.DashboardPanelSpec{
								Id: 1,
								Data: dashv2alpha1.DashboardQueryGroupKind{
									Spec: dashv2alpha1.DashboardQueryGroupSpec{
										Queries: []dashv2alpha1.DashboardPanelQueryKind{
											{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}},
											{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "B"}},
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
											{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "C"}},
										},
									},
								},
							},
						},
					},
				},
				Annotations: []dashv2alpha1.DashboardAnnotationQueryKind{{}, {}},
				Links:       []dashv2alpha1.DashboardDashboardLink{{}, {}},
				Variables:   []dashv2alpha1.DashboardVariableKind{{}, {}},
			},
		}
	}

	// Helper to create v2alpha1 dashboard with data loss
	createV2alpha1WithLoss := func(lossType string) *dashv2alpha1.Dashboard {
		dash := createV2alpha1WithData()
		switch lossType {
		case "panel":
			delete(dash.Spec.Elements, "panel2")
		case "query":
			dash.Spec.Elements["panel1"].PanelKind.Spec.Data.Spec.Queries = []dashv2alpha1.DashboardPanelQueryKind{
				{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}},
				// Missing query B
			}
		case "annotation":
			dash.Spec.Annotations = []dashv2alpha1.DashboardAnnotationQueryKind{{}}
		case "link":
			dash.Spec.Links = []dashv2alpha1.DashboardDashboardLink{{}}
		case "variable":
			dash.Spec.Variables = []dashv2alpha1.DashboardVariableKind{{}}
		}
		return dash
	}

	// Helper to create v2beta1 dashboard with data
	createV2beta1WithData := func() *dashv2beta1.Dashboard {
		return &dashv2beta1.Dashboard{
			Spec: dashv2beta1.DashboardSpec{
				Elements: map[string]dashv2beta1.DashboardElement{
					"panel1": {
						PanelKind: &dashv2beta1.DashboardPanelKind{
							Kind: "Panel",
							Spec: dashv2beta1.DashboardPanelSpec{
								Id: 1,
								Data: dashv2beta1.DashboardQueryGroupKind{
									Spec: dashv2beta1.DashboardQueryGroupSpec{
										Queries: []dashv2beta1.DashboardPanelQueryKind{
											{Spec: dashv2beta1.DashboardPanelQuerySpec{RefId: "A"}},
											{Spec: dashv2beta1.DashboardPanelQuerySpec{RefId: "B"}},
										},
									},
								},
							},
						},
					},
					"panel2": {
						PanelKind: &dashv2beta1.DashboardPanelKind{
							Kind: "Panel",
							Spec: dashv2beta1.DashboardPanelSpec{
								Id: 2,
								Data: dashv2beta1.DashboardQueryGroupKind{
									Spec: dashv2beta1.DashboardQueryGroupSpec{
										Queries: []dashv2beta1.DashboardPanelQueryKind{
											{Spec: dashv2beta1.DashboardPanelQuerySpec{RefId: "C"}},
										},
									},
								},
							},
						},
					},
				},
				Annotations: []dashv2beta1.DashboardAnnotationQueryKind{{}, {}},
				Links:       []dashv2beta1.DashboardDashboardLink{{}, {}},
				Variables:   []dashv2beta1.DashboardVariableKind{{}, {}},
			},
		}
	}

	// Helper to create v2beta1 dashboard with data loss
	createV2beta1WithLoss := func(lossType string) *dashv2beta1.Dashboard {
		dash := createV2beta1WithData()
		switch lossType {
		case "panel":
			delete(dash.Spec.Elements, "panel2")
		case "query":
			dash.Spec.Elements["panel1"].PanelKind.Spec.Data.Spec.Queries = []dashv2beta1.DashboardPanelQueryKind{
				{Spec: dashv2beta1.DashboardPanelQuerySpec{RefId: "A"}},
				// Missing query B
			}
		case "annotation":
			dash.Spec.Annotations = []dashv2beta1.DashboardAnnotationQueryKind{{}}
		case "link":
			dash.Spec.Links = []dashv2beta1.DashboardDashboardLink{{}}
		case "variable":
			dash.Spec.Variables = []dashv2beta1.DashboardVariableKind{{}}
		}
		return dash
	}

	// All loss types to test
	lossTypes := []struct {
		name           string
		expectedErrMsg string
	}{
		{"panel", "panel count decreased"},
		{"query", "query count decreased"},
		{"annotation", "annotation count decreased"},
		{"link", "link count decreased"},
		{"variable", "variable count decreased"},
	}

	// All version permutations (12 total: 4 versions × 3 targets each)
	versionPairs := []struct {
		sourceVersion string
		targetVersion string
		sourceAPI     string
		targetAPI     string
	}{
		// From v0alpha1
		{"v0alpha1", "v1beta1", dashv0.APIVERSION, dashv1.APIVERSION},
		{"v0alpha1", "v2alpha1", dashv0.APIVERSION, dashv2alpha1.APIVERSION},
		{"v0alpha1", "v2beta1", dashv0.APIVERSION, dashv2beta1.APIVERSION},
		// From v1beta1
		{"v1beta1", "v0alpha1", dashv1.APIVERSION, dashv0.APIVERSION},
		{"v1beta1", "v2alpha1", dashv1.APIVERSION, dashv2alpha1.APIVERSION},
		{"v1beta1", "v2beta1", dashv1.APIVERSION, dashv2beta1.APIVERSION},
		// From v2alpha1
		{"v2alpha1", "v0alpha1", dashv2alpha1.APIVERSION, dashv0.APIVERSION},
		{"v2alpha1", "v1beta1", dashv2alpha1.APIVERSION, dashv1.APIVERSION},
		{"v2alpha1", "v2beta1", dashv2alpha1.APIVERSION, dashv2beta1.APIVERSION},
		// From v2beta1
		{"v2beta1", "v0alpha1", dashv2beta1.APIVERSION, dashv0.APIVERSION},
		{"v2beta1", "v1beta1", dashv2beta1.APIVERSION, dashv1.APIVERSION},
		{"v2beta1", "v2alpha1", dashv2beta1.APIVERSION, dashv2alpha1.APIVERSION},
	}

	for _, vp := range versionPairs {
		for _, lt := range lossTypes {
			testName := fmt.Sprintf("%s_to_%s_%s_loss", vp.sourceVersion, vp.targetVersion, lt.name)
			t.Run(testName, func(t *testing.T) {
				var source, target interface{}

				// Create source dashboard with full data
				switch vp.sourceVersion {
				case "v0alpha1":
					source = &dashv0.Dashboard{Spec: dashv0.DashboardSpec{Object: createV0V1SpecWithData()}}
				case "v1beta1":
					source = &dashv1.Dashboard{Spec: dashv1.DashboardSpec{Object: createV0V1SpecWithData()}}
				case "v2alpha1":
					source = createV2alpha1WithData()
				case "v2beta1":
					source = createV2beta1WithData()
				}

				// Create target dashboard with data loss
				switch vp.targetVersion {
				case "v0alpha1":
					target = &dashv0.Dashboard{Spec: dashv0.DashboardSpec{Object: createV0V1SpecWithLoss(lt.name)}}
				case "v1beta1":
					target = &dashv1.Dashboard{Spec: dashv1.DashboardSpec{Object: createV0V1SpecWithLoss(lt.name)}}
				case "v2alpha1":
					target = createV2alpha1WithLoss(lt.name)
				case "v2beta1":
					target = createV2beta1WithLoss(lt.name)
				}

				// Check for data loss
				err := checkConversionDataLoss(vp.sourceAPI, vp.targetAPI, source, target)

				// Verify data loss was detected
				require.Error(t, err, "Expected %s loss to be detected for %s -> %s", lt.name, vp.sourceVersion, vp.targetVersion)
				assert.Contains(t, err.Error(), lt.expectedErrMsg)

				// Verify it's a ConversionDataLossError
				var dataLossErr *ConversionDataLossError
				require.ErrorAs(t, err, &dataLossErr)
			})
		}
	}
}

// TestDataLossDetection_NoFalsePositives_AllVersionPermutations verifies that no false positives
// are triggered for any attribute type when counts are equal or increased, across ALL version permutations.
func TestDataLossDetection_NoFalsePositives_AllVersionPermutations(t *testing.T) {
	// Helper to create v0/v1 spec with data
	createV0V1SpecWithData := func() map[string]interface{} {
		return map[string]interface{}{
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
						map[string]interface{}{"refId": "C"},
					},
				},
			},
			"annotations": map[string]interface{}{
				"list": []interface{}{
					map[string]interface{}{"name": "Annotation 1"},
					map[string]interface{}{"name": "Annotation 2"},
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
	}

	// Helper to create v2alpha1 dashboard with data
	createV2alpha1WithData := func() *dashv2alpha1.Dashboard {
		return &dashv2alpha1.Dashboard{
			Spec: dashv2alpha1.DashboardSpec{
				Elements: map[string]dashv2alpha1.DashboardElement{
					"panel1": {
						PanelKind: &dashv2alpha1.DashboardPanelKind{
							Kind: "Panel",
							Spec: dashv2alpha1.DashboardPanelSpec{
								Id: 1,
								Data: dashv2alpha1.DashboardQueryGroupKind{
									Spec: dashv2alpha1.DashboardQueryGroupSpec{
										Queries: []dashv2alpha1.DashboardPanelQueryKind{
											{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}},
											{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "B"}},
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
											{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "C"}},
										},
									},
								},
							},
						},
					},
				},
				Annotations: []dashv2alpha1.DashboardAnnotationQueryKind{{}, {}},
				Links:       []dashv2alpha1.DashboardDashboardLink{{}, {}},
				Variables:   []dashv2alpha1.DashboardVariableKind{{}, {}},
			},
		}
	}

	// Helper to create v2beta1 dashboard with data
	createV2beta1WithData := func() *dashv2beta1.Dashboard {
		return &dashv2beta1.Dashboard{
			Spec: dashv2beta1.DashboardSpec{
				Elements: map[string]dashv2beta1.DashboardElement{
					"panel1": {
						PanelKind: &dashv2beta1.DashboardPanelKind{
							Kind: "Panel",
							Spec: dashv2beta1.DashboardPanelSpec{
								Id: 1,
								Data: dashv2beta1.DashboardQueryGroupKind{
									Spec: dashv2beta1.DashboardQueryGroupSpec{
										Queries: []dashv2beta1.DashboardPanelQueryKind{
											{Spec: dashv2beta1.DashboardPanelQuerySpec{RefId: "A"}},
											{Spec: dashv2beta1.DashboardPanelQuerySpec{RefId: "B"}},
										},
									},
								},
							},
						},
					},
					"panel2": {
						PanelKind: &dashv2beta1.DashboardPanelKind{
							Kind: "Panel",
							Spec: dashv2beta1.DashboardPanelSpec{
								Id: 2,
								Data: dashv2beta1.DashboardQueryGroupKind{
									Spec: dashv2beta1.DashboardQueryGroupSpec{
										Queries: []dashv2beta1.DashboardPanelQueryKind{
											{Spec: dashv2beta1.DashboardPanelQuerySpec{RefId: "C"}},
										},
									},
								},
							},
						},
					},
				},
				Annotations: []dashv2beta1.DashboardAnnotationQueryKind{{}, {}},
				Links:       []dashv2beta1.DashboardDashboardLink{{}, {}},
				Variables:   []dashv2beta1.DashboardVariableKind{{}, {}},
			},
		}
	}

	// All 12 version permutations
	versionPairs := []struct {
		sourceVersion string
		targetVersion string
		sourceAPI     string
		targetAPI     string
	}{
		// From v0alpha1
		{"v0alpha1", "v1beta1", dashv0.APIVERSION, dashv1.APIVERSION},
		{"v0alpha1", "v2alpha1", dashv0.APIVERSION, dashv2alpha1.APIVERSION},
		{"v0alpha1", "v2beta1", dashv0.APIVERSION, dashv2beta1.APIVERSION},
		// From v1beta1
		{"v1beta1", "v0alpha1", dashv1.APIVERSION, dashv0.APIVERSION},
		{"v1beta1", "v2alpha1", dashv1.APIVERSION, dashv2alpha1.APIVERSION},
		{"v1beta1", "v2beta1", dashv1.APIVERSION, dashv2beta1.APIVERSION},
		// From v2alpha1
		{"v2alpha1", "v0alpha1", dashv2alpha1.APIVERSION, dashv0.APIVERSION},
		{"v2alpha1", "v1beta1", dashv2alpha1.APIVERSION, dashv1.APIVERSION},
		{"v2alpha1", "v2beta1", dashv2alpha1.APIVERSION, dashv2beta1.APIVERSION},
		// From v2beta1
		{"v2beta1", "v0alpha1", dashv2beta1.APIVERSION, dashv0.APIVERSION},
		{"v2beta1", "v1beta1", dashv2beta1.APIVERSION, dashv1.APIVERSION},
		{"v2beta1", "v2alpha1", dashv2beta1.APIVERSION, dashv2alpha1.APIVERSION},
	}

	for _, vp := range versionPairs {
		testName := fmt.Sprintf("%s_to_%s_no_loss", vp.sourceVersion, vp.targetVersion)
		t.Run(testName, func(t *testing.T) {
			var source, target interface{}

			// Create source dashboard with full data
			switch vp.sourceVersion {
			case "v0alpha1":
				source = &dashv0.Dashboard{Spec: dashv0.DashboardSpec{Object: createV0V1SpecWithData()}}
			case "v1beta1":
				source = &dashv1.Dashboard{Spec: dashv1.DashboardSpec{Object: createV0V1SpecWithData()}}
			case "v2alpha1":
				source = createV2alpha1WithData()
			case "v2beta1":
				source = createV2beta1WithData()
			}

			// Create target dashboard with same data (no loss)
			switch vp.targetVersion {
			case "v0alpha1":
				target = &dashv0.Dashboard{Spec: dashv0.DashboardSpec{Object: createV0V1SpecWithData()}}
			case "v1beta1":
				target = &dashv1.Dashboard{Spec: dashv1.DashboardSpec{Object: createV0V1SpecWithData()}}
			case "v2alpha1":
				target = createV2alpha1WithData()
			case "v2beta1":
				target = createV2beta1WithData()
			}

			// Check for data loss - should be none
			err := checkConversionDataLoss(vp.sourceAPI, vp.targetAPI, source, target)
			require.NoError(t, err, "Expected no data loss when data is preserved for %s -> %s", vp.sourceVersion, vp.targetVersion)
		})
	}
}

// TestDataLossDetectionOnAllInputFiles tests all conversions from testdata/input
// and logs detailed information about missing panels when data loss is detected
func TestDataLossDetectionOnAllInputFiles(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := testutil.NewDataSourceProvider(testutil.StandardTestConfig)
	leProvider := testutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
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
			for _, version := range manifest.ManifestData.Versions {
				// Skip converting to the same version
				if version.Name == gv.Version {
					continue
				}
				targetVersion := version.Name
				for _, kind := range version.Kinds {
					if kind.Kind == "Dashboard" {
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

// TestDataLossDetection_IntegrationWithRealConversions performs actual conversions
// using the scheme and verifies that data loss detection works correctly.
func TestDataLossDetection_IntegrationWithRealConversions(t *testing.T) {
	// Initialize the migrator with a test data source provider
	dsProvider := testutil.NewDataSourceProvider(testutil.StandardTestConfig)
	leProvider := testutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme, dsProvider, leProvider)
	require.NoError(t, err)

	//
	// ========== V0/V1 -> V2 CONVERSIONS (These should all pass) ==========
	//

	// Test 1: V0 Collapsed Rows -> V2alpha1
	t.Run("Integration_V0CollapsedRows_To_V2alpha1", func(t *testing.T) {
		source := &dashv0.Dashboard{
			TypeMeta: metav1.TypeMeta{
				APIVersion: dashv0.APIVERSION,
				Kind:       "Dashboard",
			},
			Spec: dashv0.DashboardSpec{
				Object: createV0V1WithCollapsedRows(2, 2, 1),
			},
		}
		sourceStats := collectStatsV0V1(source.Spec.Object)

		target := &dashv2alpha1.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV2alpha1(target.Spec)

		t.Logf("V0 Collapsed Rows -> V2alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	// Test 2: V0 Expanded Rows -> V2alpha1
	t.Run("Integration_V0ExpandedRows_To_V2alpha1", func(t *testing.T) {
		source := &dashv0.Dashboard{
			TypeMeta: metav1.TypeMeta{
				APIVersion: dashv0.APIVERSION,
				Kind:       "Dashboard",
			},
			Spec: dashv0.DashboardSpec{
				Object: createV0V1WithExpandedRows(2, 2, 1),
			},
		}
		sourceStats := collectStatsV0V1(source.Spec.Object)

		target := &dashv2alpha1.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV2alpha1(target.Spec)

		t.Logf("V0 Expanded Rows -> V2alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	// Test 3: V0 Flat Panels -> V2alpha1
	t.Run("Integration_V0FlatPanels_To_V2alpha1", func(t *testing.T) {
		source := &dashv0.Dashboard{
			TypeMeta: metav1.TypeMeta{
				APIVersion: dashv0.APIVERSION,
				Kind:       "Dashboard",
			},
			Spec: dashv0.DashboardSpec{
				Object: createV0V1FlatPanels(4, 1),
			},
		}
		sourceStats := collectStatsV0V1(source.Spec.Object)

		target := &dashv2alpha1.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV2alpha1(target.Spec)

		t.Logf("V0 Flat Panels -> V2alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	// Test 4: V0 Mixed Layout -> V2alpha1
	t.Run("Integration_V0MixedLayout_To_V2alpha1", func(t *testing.T) {
		source := &dashv0.Dashboard{
			TypeMeta: metav1.TypeMeta{
				APIVersion: dashv0.APIVERSION,
				Kind:       "Dashboard",
			},
			Spec: dashv0.DashboardSpec{
				Object: createV0V1MixedAllTypes(),
			},
		}
		sourceStats := collectStatsV0V1(source.Spec.Object)

		target := &dashv2alpha1.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV2alpha1(target.Spec)

		t.Logf("V0 Mixed Layout -> V2alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	//
	// ========== V2 -> V0/V1 CONVERSIONS ==========
	// These tests document the current state of V2 -> V0 conversions.
	//

	// Test 5: V2 Simple Tabs -> V0alpha1
	t.Run("Integration_V2SimpleTabs_To_V0alpha1", func(t *testing.T) {
		source := createV2DashboardWithSimpleTabs()
		source.TypeMeta = metav1.TypeMeta{
			APIVersion: dashv2alpha1.APIVERSION,
			Kind:       "Dashboard",
		}
		sourceStats := collectStatsV2alpha1(source.Spec)

		target := &dashv0.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV0V1(target.Spec.Object)

		t.Logf("V2 Simple Tabs -> V0alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	// Test 6: V2 Rows Collapsed -> V0alpha1
	t.Run("Integration_V2RowsCollapsed_To_V0alpha1", func(t *testing.T) {
		source := createV2DashboardWithRowsCollapsed()
		source.TypeMeta = metav1.TypeMeta{
			APIVersion: dashv2alpha1.APIVERSION,
			Kind:       "Dashboard",
		}
		sourceStats := collectStatsV2alpha1(source.Spec)

		target := &dashv0.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV0V1(target.Spec.Object)

		t.Logf("V2 Rows Collapsed -> V0alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	// Test 7: V2 Rows Expanded -> V0alpha1
	t.Run("Integration_V2RowsExpanded_To_V0alpha1", func(t *testing.T) {
		source := createV2DashboardWithRowsExpanded()
		source.TypeMeta = metav1.TypeMeta{
			APIVersion: dashv2alpha1.APIVERSION,
			Kind:       "Dashboard",
		}
		sourceStats := collectStatsV2alpha1(source.Spec)

		target := &dashv0.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV0V1(target.Spec.Object)

		t.Logf("V2 Rows Expanded -> V0alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	// Test 8: V2 Tabs with Nested Rows -> V0alpha1
	t.Run("Integration_V2TabsWithNestedRows_To_V0alpha1", func(t *testing.T) {
		source := createV2DashboardWithTabsAndNestedRows()
		source.TypeMeta = metav1.TypeMeta{
			APIVersion: dashv2alpha1.APIVERSION,
			Kind:       "Dashboard",
		}
		sourceStats := collectStatsV2alpha1(source.Spec)

		target := &dashv0.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV0V1(target.Spec.Object)

		t.Logf("V2 Tabs with Nested Rows -> V0alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	// Test 9: V2 Rows with Nested Tabs -> V0alpha1
	t.Run("Integration_V2RowsWithNestedTabs_To_V0alpha1", func(t *testing.T) {
		source := createV2DashboardWithRowsAndNestedTabs()
		source.TypeMeta = metav1.TypeMeta{
			APIVersion: dashv2alpha1.APIVERSION,
			Kind:       "Dashboard",
		}
		sourceStats := collectStatsV2alpha1(source.Spec)

		target := &dashv0.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV0V1(target.Spec.Object)

		t.Logf("V2 Rows with Nested Tabs -> V0alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	// Test 10: V2 Complex Nesting -> V0alpha1
	t.Run("Integration_V2ComplexNesting_To_V0alpha1", func(t *testing.T) {
		source := createV2ComplexNestedDashboard()
		source.TypeMeta = metav1.TypeMeta{
			APIVersion: dashv2alpha1.APIVERSION,
			Kind:       "Dashboard",
		}
		sourceStats := collectStatsV2alpha1(source.Spec)

		target := &dashv0.Dashboard{}
		err := scheme.Convert(source, target, nil)
		require.NoError(t, err, "Conversion should succeed")

		targetStats := collectStatsV0V1(target.Spec.Object)

		t.Logf("V2 Complex Nesting -> V0alpha1:")
		t.Logf("  Source: panels=%d, queries=%d", sourceStats.panelCount, sourceStats.queryCount)
		t.Logf("  Target: panels=%d, queries=%d", targetStats.panelCount, targetStats.queryCount)

		assert.Equal(t, sourceStats.panelCount, targetStats.panelCount, "Panel count should match")
		assert.Equal(t, sourceStats.queryCount, targetStats.queryCount, "Query count should match")
	})

	//
	// ========== ROUND-TRIP CONVERSIONS ==========
	//

	// Test 11: V2 -> V0 -> V2 round-trip (panel count should be preserved)
	t.Run("Integration_RoundTrip_V2_V0_V2", func(t *testing.T) {
		original := createV2DashboardWithSimpleTabs()
		original.TypeMeta = metav1.TypeMeta{
			APIVersion: dashv2alpha1.APIVERSION,
			Kind:       "Dashboard",
		}
		originalStats := collectStatsV2alpha1(original.Spec)

		// V2 -> V0
		intermediate := &dashv0.Dashboard{}
		err := scheme.Convert(original, intermediate, nil)
		require.NoError(t, err, "V2 -> V0 conversion should succeed")
		intermediateStats := collectStatsV0V1(intermediate.Spec.Object)

		// V0 -> V2
		final := &dashv2alpha1.Dashboard{}
		err = scheme.Convert(intermediate, final, nil)
		require.NoError(t, err, "V0 -> V2 conversion should succeed")
		finalStats := collectStatsV2alpha1(final.Spec)

		t.Logf("Round-trip V2 -> V0 -> V2:")
		t.Logf("  Original (V2): panels=%d, queries=%d", originalStats.panelCount, originalStats.queryCount)
		t.Logf("  Intermediate (V0): panels=%d, queries=%d", intermediateStats.panelCount, intermediateStats.queryCount)
		t.Logf("  Final (V2): panels=%d, queries=%d", finalStats.panelCount, finalStats.queryCount)

		// Panel count should be preserved through round-trip
		assert.Equal(t, originalStats.panelCount, finalStats.panelCount, "Panel count should match after round-trip")

		// Document query behavior
		if intermediateStats.queryCount < originalStats.queryCount {
			t.Logf("  ⚠️ Queries lost in V2->V0: %d -> %d", originalStats.queryCount, intermediateStats.queryCount)
		}
		if finalStats.queryCount != originalStats.queryCount {
			t.Logf("  ⚠️ Final query count differs: original=%d, final=%d", originalStats.queryCount, finalStats.queryCount)
		}
	})

	// Test 12: V0 -> V2 -> V0 round-trip
	t.Run("Integration_RoundTrip_V0_V2_V0", func(t *testing.T) {
		original := &dashv0.Dashboard{
			TypeMeta: metav1.TypeMeta{
				APIVersion: dashv0.APIVERSION,
				Kind:       "Dashboard",
			},
			Spec: dashv0.DashboardSpec{
				Object: createV0V1MixedAllTypes(),
			},
		}
		originalStats := collectStatsV0V1(original.Spec.Object)

		// V0 -> V2
		intermediate := &dashv2alpha1.Dashboard{}
		err := scheme.Convert(original, intermediate, nil)
		require.NoError(t, err, "V0 -> V2 conversion should succeed")
		intermediateStats := collectStatsV2alpha1(intermediate.Spec)

		// V2 -> V0
		final := &dashv0.Dashboard{}
		err = scheme.Convert(intermediate, final, nil)
		require.NoError(t, err, "V2 -> V0 conversion should succeed")
		finalStats := collectStatsV0V1(final.Spec.Object)

		t.Logf("Round-trip V0 -> V2 -> V0:")
		t.Logf("  Original (V0): panels=%d, queries=%d", originalStats.panelCount, originalStats.queryCount)
		t.Logf("  Intermediate (V2): panels=%d, queries=%d", intermediateStats.panelCount, intermediateStats.queryCount)
		t.Logf("  Final (V0): panels=%d, queries=%d", finalStats.panelCount, finalStats.queryCount)

		// V0 -> V2 should preserve everything
		assert.Equal(t, originalStats.panelCount, intermediateStats.panelCount, "V0->V2 should preserve panels")
		assert.Equal(t, originalStats.queryCount, intermediateStats.queryCount, "V0->V2 should preserve queries")

		// Document what happens in V2 -> V0
		assert.Equal(t, originalStats.panelCount, finalStats.panelCount, "Panel count should match after round-trip")

		if finalStats.queryCount < originalStats.queryCount {
			t.Logf("  ⚠️ Queries lost in V2->V0 leg: %d -> %d", intermediateStats.queryCount, finalStats.queryCount)
		}
	})
}

// Helper functions to create test dashboards

// ========== V2 Dashboard Fixtures ==========

// createV2DashboardWithSimpleTabs creates a V2 dashboard with simple TabsLayout
// Structure: TabsLayout > Tab1[panel1, panel2] + Tab2[panel3, panel4]
func createV2DashboardWithSimpleTabs() *dashv2alpha1.Dashboard {
	elements := map[string]dashv2alpha1.DashboardElement{}
	for i := 1; i <= 4; i++ {
		tabNum := (i-1)/2 + 1
		elements[fmt.Sprintf("panel%d", i)] = dashv2alpha1.DashboardElement{
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id:        float64(i),
					Title:     fmt.Sprintf("Panel %d - Tab %d", i, tabNum),
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "timeseries"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{
								{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}},
							},
						},
					},
				},
			},
		}
	}

	return &dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Elements: elements,
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				TabsLayoutKind: &dashv2alpha1.DashboardTabsLayoutKind{
					Kind: "TabsLayout",
					Spec: dashv2alpha1.DashboardTabsLayoutSpec{
						Tabs: []dashv2alpha1.DashboardTabsLayoutTabKind{
							{
								Kind: "TabsLayoutTab",
								Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
									Title: ptrString("Tab 1"),
									Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
										GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv2alpha1.DashboardGridLayoutSpec{
												Items: []dashv2alpha1.DashboardGridLayoutItemKind{
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel1"}}},
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel2"}}},
												},
											},
										},
									},
								},
							},
							{
								Kind: "TabsLayoutTab",
								Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
									Title: ptrString("Tab 2"),
									Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
										GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv2alpha1.DashboardGridLayoutSpec{
												Items: []dashv2alpha1.DashboardGridLayoutItemKind{
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel3"}}},
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel4"}}},
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
}

// createV2DashboardWithRowsCollapsed creates a V2 dashboard with RowsLayout (collapsed rows)
// Structure: RowsLayout > Row1(collapsed)[panel1, panel2] + Row2(collapsed)[panel3, panel4]
func createV2DashboardWithRowsCollapsed() *dashv2alpha1.Dashboard {
	elements := map[string]dashv2alpha1.DashboardElement{}
	for i := 1; i <= 4; i++ {
		rowNum := (i-1)/2 + 1
		elements[fmt.Sprintf("panel%d", i)] = dashv2alpha1.DashboardElement{
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id:        float64(i),
					Title:     fmt.Sprintf("Panel %d - Row %d (collapsed)", i, rowNum),
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "timeseries"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{
								{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}},
							},
						},
					},
				},
			},
		}
	}

	collapsed := true
	return &dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Elements: elements,
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
					Kind: "RowsLayout",
					Spec: dashv2alpha1.DashboardRowsLayoutSpec{
						Rows: []dashv2alpha1.DashboardRowsLayoutRowKind{
							{
								Kind: "RowsLayoutRow",
								Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
									Title:    ptrString("Row 1 (collapsed)"),
									Collapse: &collapsed,
									Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
										GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv2alpha1.DashboardGridLayoutSpec{
												Items: []dashv2alpha1.DashboardGridLayoutItemKind{
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel1"}}},
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel2"}}},
												},
											},
										},
									},
								},
							},
							{
								Kind: "RowsLayoutRow",
								Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
									Title:    ptrString("Row 2 (collapsed)"),
									Collapse: &collapsed,
									Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
										GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv2alpha1.DashboardGridLayoutSpec{
												Items: []dashv2alpha1.DashboardGridLayoutItemKind{
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel3"}}},
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel4"}}},
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
}

// createV2DashboardWithRowsExpanded creates a V2 dashboard with RowsLayout (expanded rows)
// Structure: RowsLayout > Row1(expanded)[panel1, panel2] + Row2(expanded)[panel3, panel4]
func createV2DashboardWithRowsExpanded() *dashv2alpha1.Dashboard {
	elements := map[string]dashv2alpha1.DashboardElement{}
	for i := 1; i <= 4; i++ {
		rowNum := (i-1)/2 + 1
		elements[fmt.Sprintf("panel%d", i)] = dashv2alpha1.DashboardElement{
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id:        float64(i),
					Title:     fmt.Sprintf("Panel %d - Row %d (expanded)", i, rowNum),
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "timeseries"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{
								{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}},
							},
						},
					},
				},
			},
		}
	}

	expanded := false // collapse=false means expanded
	return &dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Elements: elements,
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
					Kind: "RowsLayout",
					Spec: dashv2alpha1.DashboardRowsLayoutSpec{
						Rows: []dashv2alpha1.DashboardRowsLayoutRowKind{
							{
								Kind: "RowsLayoutRow",
								Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
									Title:    ptrString("Row 1 (expanded)"),
									Collapse: &expanded,
									Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
										GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv2alpha1.DashboardGridLayoutSpec{
												Items: []dashv2alpha1.DashboardGridLayoutItemKind{
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel1"}}},
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel2"}}},
												},
											},
										},
									},
								},
							},
							{
								Kind: "RowsLayoutRow",
								Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
									Title:    ptrString("Row 2 (expanded)"),
									Collapse: &expanded,
									Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
										GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv2alpha1.DashboardGridLayoutSpec{
												Items: []dashv2alpha1.DashboardGridLayoutItemKind{
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel3"}}},
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel4"}}},
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
}

func createV0V1FlatPanels(numPanels, queriesPerPanel int) map[string]interface{} {
	panels := make([]interface{}, numPanels)
	for i := 0; i < numPanels; i++ {
		targets := make([]interface{}, queriesPerPanel)
		for q := 0; q < queriesPerPanel; q++ {
			targets[q] = map[string]interface{}{"refId": fmt.Sprintf("%c", 'A'+q)}
		}
		panels[i] = map[string]interface{}{
			"id":      float64(i + 1),
			"title":   fmt.Sprintf("Panel %d", i+1),
			"type":    "timeseries",
			"targets": targets,
		}
	}
	return map[string]interface{}{"panels": panels}
}

func createV0V1WithCollapsedRows(numRows, panelsPerRow, queriesPerPanel int) map[string]interface{} {
	panels := make([]interface{}, 0)
	panelID := 1

	for r := 0; r < numRows; r++ {
		// Create collapsed panels for this row
		collapsedPanels := make([]interface{}, panelsPerRow)
		for p := 0; p < panelsPerRow; p++ {
			targets := make([]interface{}, queriesPerPanel)
			for q := 0; q < queriesPerPanel; q++ {
				targets[q] = map[string]interface{}{"refId": fmt.Sprintf("%c", 'A'+q)}
			}
			collapsedPanels[p] = map[string]interface{}{
				"id":      float64(panelID),
				"title":   fmt.Sprintf("Panel %d (in Row %d)", panelID, r+1),
				"type":    "timeseries",
				"targets": targets,
			}
			panelID++
		}

		// Add row with collapsed panels
		panels = append(panels, map[string]interface{}{
			"id":        float64(100 + r),
			"title":     fmt.Sprintf("Row %d (collapsed)", r+1),
			"type":      "row",
			"collapsed": true,
			"panels":    collapsedPanels,
		})
	}
	return map[string]interface{}{"panels": panels}
}

func createV0V1WithExpandedRows(numRows, panelsPerRow, queriesPerPanel int) map[string]interface{} {
	panels := make([]interface{}, 0)
	panelID := 1

	for r := 0; r < numRows; r++ {
		// Add expanded row (no nested panels)
		panels = append(panels, map[string]interface{}{
			"id":    float64(100 + r),
			"title": fmt.Sprintf("Row %d (expanded)", r+1),
			"type":  "row",
			// No "panels" field when row is expanded
		})

		// Add panels after the row
		for p := 0; p < panelsPerRow; p++ {
			targets := make([]interface{}, queriesPerPanel)
			for q := 0; q < queriesPerPanel; q++ {
				targets[q] = map[string]interface{}{"refId": fmt.Sprintf("%c", 'A'+q)}
			}
			panels = append(panels, map[string]interface{}{
				"id":      float64(panelID),
				"title":   fmt.Sprintf("Panel %d (after Row %d)", panelID, r+1),
				"type":    "timeseries",
				"targets": targets,
			})
			panelID++
		}
	}
	return map[string]interface{}{"panels": panels}
}

func createV2DashboardWithTabsAndNestedRows() *dashv2alpha1.Dashboard {
	// 2 tabs, each with 1 row containing 2 panels = 4 panels total
	// Structure: TabsLayout > Tab1[RowsLayout > Row[panel1, panel2]] + Tab2[RowsLayout > Row[panel3, panel4]]
	elements := map[string]dashv2alpha1.DashboardElement{
		"panel1": {
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id: 1, Title: "Panel 1 - Tab1/Row1",
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "timeseries"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		},
		"panel2": {
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id: 2, Title: "Panel 2 - Tab1/Row1",
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "stat"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		},
		"panel3": {
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id: 3, Title: "Panel 3 - Tab2/Row1",
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "gauge"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		},
		"panel4": {
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id: 4, Title: "Panel 4 - Tab2/Row1",
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "table"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		},
	}

	return &dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Elements: elements,
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				TabsLayoutKind: &dashv2alpha1.DashboardTabsLayoutKind{
					Kind: "TabsLayout",
					Spec: dashv2alpha1.DashboardTabsLayoutSpec{
						Tabs: []dashv2alpha1.DashboardTabsLayoutTabKind{
							{
								Kind: "TabsLayoutTab",
								Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
									Title: ptrString("Tab 1"),
									Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
										RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
											Kind: "RowsLayout",
											Spec: dashv2alpha1.DashboardRowsLayoutSpec{
												Rows: []dashv2alpha1.DashboardRowsLayoutRowKind{
													{
														Kind: "RowsLayoutRow",
														Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
															Title: ptrString("Row 1"),
															Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
																GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
																	Kind: "GridLayout",
																	Spec: dashv2alpha1.DashboardGridLayoutSpec{
																		Items: []dashv2alpha1.DashboardGridLayoutItemKind{
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel1"}}},
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel2"}}},
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
							{
								Kind: "TabsLayoutTab",
								Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
									Title: ptrString("Tab 2"),
									Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
										RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
											Kind: "RowsLayout",
											Spec: dashv2alpha1.DashboardRowsLayoutSpec{
												Rows: []dashv2alpha1.DashboardRowsLayoutRowKind{
													{
														Kind: "RowsLayoutRow",
														Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
															Title: ptrString("Row 1"),
															Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
																GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
																	Kind: "GridLayout",
																	Spec: dashv2alpha1.DashboardGridLayoutSpec{
																		Items: []dashv2alpha1.DashboardGridLayoutItemKind{
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel3"}}},
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel4"}}},
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
				},
			},
		},
	}
}

func createV2DashboardWithRowsAndNestedTabs() *dashv2alpha1.Dashboard {
	// 2 rows, each containing a tab layout with 2 panels = 4 panels total
	// Structure: RowsLayout > Row1[TabsLayout > Tab[panel1, panel2]] + Row2[TabsLayout > Tab[panel3, panel4]]
	elements := map[string]dashv2alpha1.DashboardElement{
		"panel1": {
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id: 1, Title: "Panel 1 - Row1/TabA",
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "timeseries"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		},
		"panel2": {
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id: 2, Title: "Panel 2 - Row1/TabB",
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "stat"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		},
		"panel3": {
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id: 3, Title: "Panel 3 - Row2/TabA",
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "gauge"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		},
		"panel4": {
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id: 4, Title: "Panel 4 - Row2/TabB",
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "table"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		},
	}

	return &dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Elements: elements,
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
					Kind: "RowsLayout",
					Spec: dashv2alpha1.DashboardRowsLayoutSpec{
						Rows: []dashv2alpha1.DashboardRowsLayoutRowKind{
							{
								Kind: "RowsLayoutRow",
								Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
									Title: ptrString("Row 1"),
									Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
										TabsLayoutKind: &dashv2alpha1.DashboardTabsLayoutKind{
											Kind: "TabsLayout",
											Spec: dashv2alpha1.DashboardTabsLayoutSpec{
												Tabs: []dashv2alpha1.DashboardTabsLayoutTabKind{
													{
														Kind: "TabsLayoutTab",
														Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
															Title: ptrString("Tab A"),
															Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
																GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
																	Kind: "GridLayout",
																	Spec: dashv2alpha1.DashboardGridLayoutSpec{
																		Items: []dashv2alpha1.DashboardGridLayoutItemKind{
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel1"}}},
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel2"}}},
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
							{
								Kind: "RowsLayoutRow",
								Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
									Title: ptrString("Row 2"),
									Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
										TabsLayoutKind: &dashv2alpha1.DashboardTabsLayoutKind{
											Kind: "TabsLayout",
											Spec: dashv2alpha1.DashboardTabsLayoutSpec{
												Tabs: []dashv2alpha1.DashboardTabsLayoutTabKind{
													{
														Kind: "TabsLayoutTab",
														Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
															Title: ptrString("Tab A"),
															Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
																GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
																	Kind: "GridLayout",
																	Spec: dashv2alpha1.DashboardGridLayoutSpec{
																		Items: []dashv2alpha1.DashboardGridLayoutItemKind{
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel3"}}},
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel4"}}},
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
				},
			},
		},
	}
}

func createV2ComplexNestedDashboard() *dashv2alpha1.Dashboard {
	// Complex: 2 tabs, Tab1 has 2 rows (each with 2 panels), Tab2 has 2 panels directly
	// Total: 6 panels
	// Structure: TabsLayout > Tab1[RowsLayout > Row1[p1,p2] + Row2[p3,p4]] + Tab2[GridLayout > p5,p6]
	elements := map[string]dashv2alpha1.DashboardElement{}
	for i := 1; i <= 6; i++ {
		elements[fmt.Sprintf("panel%d", i)] = dashv2alpha1.DashboardElement{
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id:        float64(i),
					Title:     fmt.Sprintf("Panel %d", i),
					VizConfig: dashv2alpha1.DashboardVizConfigKind{Kind: "timeseries"},
					Data: dashv2alpha1.DashboardQueryGroupKind{
						Spec: dashv2alpha1.DashboardQueryGroupSpec{
							Queries: []dashv2alpha1.DashboardPanelQueryKind{{Spec: dashv2alpha1.DashboardPanelQuerySpec{RefId: "A"}}},
						},
					},
				},
			},
		}
	}

	return &dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Elements: elements,
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				TabsLayoutKind: &dashv2alpha1.DashboardTabsLayoutKind{
					Kind: "TabsLayout",
					Spec: dashv2alpha1.DashboardTabsLayoutSpec{
						Tabs: []dashv2alpha1.DashboardTabsLayoutTabKind{
							{
								Kind: "TabsLayoutTab",
								Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
									Title: ptrString("Tab 1"),
									Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
										RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
											Kind: "RowsLayout",
											Spec: dashv2alpha1.DashboardRowsLayoutSpec{
												Rows: []dashv2alpha1.DashboardRowsLayoutRowKind{
													{
														Kind: "RowsLayoutRow",
														Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
															Title: ptrString("Row 1"),
															Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
																GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
																	Kind: "GridLayout",
																	Spec: dashv2alpha1.DashboardGridLayoutSpec{
																		Items: []dashv2alpha1.DashboardGridLayoutItemKind{
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel1"}}},
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel2"}}},
																		},
																	},
																},
															},
														},
													},
													{
														Kind: "RowsLayoutRow",
														Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
															Title: ptrString("Row 2"),
															Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
																GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
																	Kind: "GridLayout",
																	Spec: dashv2alpha1.DashboardGridLayoutSpec{
																		Items: []dashv2alpha1.DashboardGridLayoutItemKind{
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel3"}}},
																			{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel4"}}},
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
							{
								Kind: "TabsLayoutTab",
								Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
									Title: ptrString("Tab 2"),
									Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
										GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
											Kind: "GridLayout",
											Spec: dashv2alpha1.DashboardGridLayoutSpec{
												Items: []dashv2alpha1.DashboardGridLayoutItemKind{
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel5"}}},
													{Spec: dashv2alpha1.DashboardGridLayoutItemSpec{Element: dashv2alpha1.DashboardElementReference{Name: "panel6"}}},
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
}

// createV0V1MixedAllTypes creates a V0/V1 dashboard with ALL layout types:
// - Panels out of rows (flat, top-level)
// - Collapsed row with nested panels
// - Expanded row followed by panels
// Structure: [p1, p2, Row1(collapsed){p3,p4}, Row2(expanded), p5, p6]
// Total: 6 panels
func createV0V1MixedAllTypes() map[string]interface{} {
	panels := []interface{}{
		// Flat panels out of rows (at the beginning)
		map[string]interface{}{
			"id":    float64(1),
			"title": "Panel 1 (flat, no row)",
			"type":  "timeseries",
			"targets": []interface{}{
				map[string]interface{}{"refId": "A"},
			},
		},
		map[string]interface{}{
			"id":    float64(2),
			"title": "Panel 2 (flat, no row)",
			"type":  "stat",
			"targets": []interface{}{
				map[string]interface{}{"refId": "A"},
			},
		},

		// Collapsed row with nested panels
		map[string]interface{}{
			"id":        float64(100),
			"title":     "Row 1 (collapsed)",
			"type":      "row",
			"collapsed": true,
			"panels": []interface{}{
				map[string]interface{}{
					"id":    float64(3),
					"title": "Panel 3 (in collapsed row)",
					"type":  "gauge",
					"targets": []interface{}{
						map[string]interface{}{"refId": "A"},
					},
				},
				map[string]interface{}{
					"id":    float64(4),
					"title": "Panel 4 (in collapsed row)",
					"type":  "table",
					"targets": []interface{}{
						map[string]interface{}{"refId": "A"},
					},
				},
			},
		},

		// Expanded row (empty, panels follow after)
		map[string]interface{}{
			"id":    float64(101),
			"title": "Row 2 (expanded)",
			"type":  "row",
			// No "panels" field when row is expanded
		},

		// Panels after expanded row
		map[string]interface{}{
			"id":    float64(5),
			"title": "Panel 5 (after expanded row)",
			"type":  "bargauge",
			"targets": []interface{}{
				map[string]interface{}{"refId": "A"},
			},
		},
		map[string]interface{}{
			"id":    float64(6),
			"title": "Panel 6 (after expanded row)",
			"type":  "piechart",
			"targets": []interface{}{
				map[string]interface{}{"refId": "A"},
			},
		},
	}

	return map[string]interface{}{"panels": panels}
}

// ptrString is a helper to create a pointer to a string
func ptrString(s string) *string {
	return &s
}

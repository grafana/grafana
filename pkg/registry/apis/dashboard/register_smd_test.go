package dashboard

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/schemaconv"
	"k8s.io/kube-openapi/pkg/validation/spec"
	smdschema "sigs.k8s.io/structured-merge-diff/v6/schema"
	"sigs.k8s.io/structured-merge-diff/v6/typed"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
)

// TestRelaxDashboardSchemasForSMD reproduces the "[SHOULD NOT HAPPEN] failed to
// update managedFields ... to smd typed" failure and verifies the schema
// relaxation fixes it. The apiserver field manager converts the object to a
// structured-merge-diff typed value via schemaconv.ToSchemaFromOpenAPI +
// typed.Parser (exactly what is exercised here); if that conversion fails,
// managedFields (Server-Side-Apply ownership) is silently dropped.
func TestRelaxDashboardSchemasForSMD(t *testing.T) {
	// A minimal but realistic v2 dashboard spec covering every field flavour that
	// tripped the converter: kind/spec discriminated unions (elements, layout,
	// variables, preferences.layout) and the opaque, scalar-valued query spec.
	specValue := map[string]interface{}{
		"annotations": []interface{}{
			map[string]interface{}{
				"kind": "AnnotationQuery",
				"spec": map[string]interface{}{
					"query": map[string]interface{}{
						"kind":    "DataQuery",
						"group":   "grafana",
						"version": "v0",
						"spec": map[string]interface{}{
							"limit":    int64(3),
							"matchAny": true,
							"tags":     []interface{}{"a", "b"},
							"type":     "dashboard",
						},
					},
				},
			},
		},
		"elements": map[string]interface{}{
			"panel-1": map[string]interface{}{
				"kind": "Panel",
				"spec": map[string]interface{}{"id": int64(1)},
			},
		},
		"layout": map[string]interface{}{
			"kind": "GridLayout",
			"spec": map[string]interface{}{},
		},
		"variables": []interface{}{
			map[string]interface{}{
				"kind": "QueryVariable",
				"spec": map[string]interface{}{},
			},
		},
		"preferences": map[string]interface{}{
			"layout": map[string]interface{}{
				"kind": "AutoGridLayout",
				"spec": map[string]interface{}{},
			},
		},
	}

	specModel := dashv2.DashboardSpec{}.OpenAPIModelName()

	// Baseline: the unmodified generated schema cannot type-convert the object.
	baseline := parserFromDefs(t, dashboardV2Defs())
	_, err := baseline.Type(specModel).FromUnstructured(specValue)
	require.Error(t, err, "expected the unmodified v2 schema to fail SMD conversion")

	// After relaxation the same object converts cleanly.
	fixed := dashboardV2Defs()
	relaxDashboardSchemasForSMD(fixed)
	_, err = parserFromDefs(t, fixed).Type(specModel).FromUnstructured(specValue)
	require.NoError(t, err, "relaxed v2 schema should type-convert the dashboard spec")
}

func TestIsGeneratedUnionSchema(t *testing.T) {
	defs := dashboardV2Defs()

	// A generated union wrapper: all properties are PascalCase Go variant names.
	union := defs[dashv2.DashboardPanelKindOrLibraryPanelKind{}.OpenAPIModelName()]
	require.True(t, isGeneratedUnionSchema(union.Schema))

	// A real kind exposes camelCase JSON fields and must not be treated as a union.
	real := defs[dashv2.DashboardPanelKind{}.OpenAPIModelName()]
	require.NotEmpty(t, real.Schema.Properties)
	require.False(t, isGeneratedUnionSchema(real.Schema))
}

// dashboardV2Defs returns a fresh copy of the generated v2 OpenAPI definitions
// with refs pointing at their model-name keys, so schemaconv can resolve them.
func dashboardV2Defs() map[string]common.OpenAPIDefinition {
	ref := func(path string) spec.Ref { return spec.MustCreateRef("#/definitions/" + path) }
	return dashv2.GetOpenAPIDefinitions(ref)
}

func parserFromDefs(t *testing.T, defs map[string]common.OpenAPIDefinition) *typed.Parser {
	t.Helper()
	models := make(map[string]*spec.Schema, len(defs))
	for name, def := range defs {
		s := def.Schema
		models[name] = &s
	}
	typeSchema, err := schemaconv.ToSchemaFromOpenAPI(models, false)
	require.NoError(t, err)
	return &typed.Parser{Schema: smdschema.Schema{Types: typeSchema.Types}}
}

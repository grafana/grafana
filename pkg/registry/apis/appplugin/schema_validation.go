package appplugin

import (
	"maps"
	"slices"

	"k8s.io/apiextensions-apiserver/pkg/apiserver/validation"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// newKindSchemaValidator expands refs that kube-openapi's validator cannot resolve.
func newKindSchemaValidator(kindSchema spec.Schema, defs map[string]common.OpenAPIDefinition) validation.SchemaValidator {
	// The API server validates these common fields.
	root := kindSchema
	root.Properties = maps.Clone(kindSchema.Properties)
	root.Required = slices.Clone(kindSchema.Required)
	for _, name := range []string{"metadata", "kind", "apiVersion"} {
		delete(root.Properties, name)
		root.Required = slices.DeleteFunc(root.Required, func(r string) bool { return r == name })
	}
	expanded := expandSchemaRefs(root, defs, map[string]bool{})
	return validation.NewSchemaValidatorFromOpenAPI(&expanded)
}

// expandSchemaRefs replaces refs with definitions. Cycles become permissive schemas.
func expandSchemaRefs(s spec.Schema, defs map[string]common.OpenAPIDefinition, expanding map[string]bool) spec.Schema {
	if ref := s.Ref.String(); ref != "" {
		def, ok := defs[ref]
		if !ok || expanding[ref] {
			return spec.Schema{}
		}
		expanding[ref] = true
		out := expandSchemaRefs(def.Schema, defs, expanding)
		delete(expanding, ref)
		return out
	}

	out := s
	out.Definitions = nil // never consulted by the validator
	if len(s.Properties) > 0 {
		out.Properties = make(map[string]spec.Schema, len(s.Properties))
		for k, v := range s.Properties {
			out.Properties[k] = expandSchemaRefs(v, defs, expanding)
		}
	}
	if s.AdditionalProperties != nil && s.AdditionalProperties.Schema != nil {
		ap := *s.AdditionalProperties
		sub := expandSchemaRefs(*ap.Schema, defs, expanding)
		ap.Schema = &sub
		out.AdditionalProperties = &ap
	}
	if s.AdditionalItems != nil && s.AdditionalItems.Schema != nil {
		ai := *s.AdditionalItems
		sub := expandSchemaRefs(*ai.Schema, defs, expanding)
		ai.Schema = &sub
		out.AdditionalItems = &ai
	}
	if s.Items != nil {
		items := *s.Items
		if items.Schema != nil {
			sub := expandSchemaRefs(*items.Schema, defs, expanding)
			items.Schema = &sub
		}
		if len(items.Schemas) > 0 {
			items.Schemas = expandSchemaSlice(items.Schemas, defs, expanding)
		}
		out.Items = &items
	}
	out.AllOf = expandSchemaSlice(s.AllOf, defs, expanding)
	out.AnyOf = expandSchemaSlice(s.AnyOf, defs, expanding)
	out.OneOf = expandSchemaSlice(s.OneOf, defs, expanding)
	if s.Not != nil {
		sub := expandSchemaRefs(*s.Not, defs, expanding)
		out.Not = &sub
	}
	return out
}

func expandSchemaSlice(in []spec.Schema, defs map[string]common.OpenAPIDefinition, expanding map[string]bool) []spec.Schema {
	if len(in) == 0 {
		return in
	}
	out := make([]spec.Schema, len(in))
	for i, v := range in {
		out[i] = expandSchemaRefs(v, defs, expanding)
	}
	return out
}

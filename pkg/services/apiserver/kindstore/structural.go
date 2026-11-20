package kindstore

import (
	"encoding/json"
	"fmt"
	"maps"
	"reflect"
	"slices"
	"strings"

	"k8s.io/apiextensions-apiserver/pkg/apis/apiextensions"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	structuralschema "k8s.io/apiextensions-apiserver/pkg/apiserver/schema"
	structuraldefaulting "k8s.io/apiextensions-apiserver/pkg/apiserver/schema/defaulting"
	structuralpruning "k8s.io/apiextensions-apiserver/pkg/apiserver/schema/pruning"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// newStructuralSchema builds the structural schema pruning and defaulting
// need, from the same manifest schema the validator is built from.
//
// The same kind served as a custom resource definition is pruned and defaulted
// against a schema derived this way, so a kind served here has to be too, or the
// object one path stores is not the object the other stores.
//
// Not every manifest schema can produce one: a schema that is not structural is
// one apiextensions would refuse to serve as a CRD at all. Those return an error
// and the kind is served without pruning, which is what it got before this
// existed -- worse than a CRD, but better than dropping the kind.
func newStructuralSchema(kindSchema spec.Schema, defs map[string]common.OpenAPIDefinition) (*structuralschema.Structural, error) {
	// Refs are expanded because a structural schema cannot carry one; the
	// validator resolves them the same way, from the same trimmed root.
	expanded := expandSchemaRefs(schemaRoot(kindSchema), defs, map[string]bool{})
	// A ref beside a description or default is written as an allOf around it,
	// which leaves the referenced type inside a junction once expanded.
	liftAllOf(&expanded)

	// Routed through JSON because the two schema types describe the same
	// document and nothing converts between them directly.
	raw, err := json.Marshal(expanded)
	if err != nil {
		return nil, fmt.Errorf("marshalling schema: %w", err)
	}
	external := &apiextensionsv1.JSONSchemaProps{}
	if err := json.Unmarshal(raw, external); err != nil {
		return nil, fmt.Errorf("reading schema as JSONSchemaProps: %w", err)
	}
	internal := &apiextensions.JSONSchemaProps{}
	if err := apiextensionsv1.Convert_v1_JSONSchemaProps_To_apiextensions_JSONSchemaProps(external, internal, nil); err != nil {
		return nil, fmt.Errorf("converting schema: %w", err)
	}
	structural, err := structuralschema.NewStructural(internal)
	if err != nil {
		return nil, err
	}
	// Checked, not assumed: NewStructural accepts shapes apiextensions would
	// still refuse in a CRD, and pruning a schema that is not structural silently
	// does the wrong thing rather than failing. A kind whose schema does not pass
	// here is one no CRD could serve, so falling back to validation alone is the
	// closest this can get to matching it.
	if errs := structuralschema.ValidateStructural(field.NewPath(""), structural); len(errs) > 0 {
		return nil, errs.ToAggregate()
	}
	return structural, nil
}

// pruneAndDefault drops fields the schema does not declare and fills in the
// defaults it does, the two passes apiextensions runs before validating a custom
// resource. A no-op for a kind with no schema, or one whose schema is not
// structural.
func (s *Store) pruneAndDefault(u *unstructured.Unstructured) {
	if s.structural == nil {
		return
	}
	// isResourceRoot, so apiVersion, kind and metadata survive a schema that
	// does not describe them -- which a manifest schema never does.
	structuralpruning.Prune(u.Object, s.structural, true)
	structuraldefaulting.Default(u.Object, s.structural)
}

// liftAllOf moves what a structural schema forbids inside allOf -- types,
// properties, descriptions, defaults and the rest -- out of each branch and into
// the schema that holds it, the way a CRD author would write the same schema.
// What only validates values, such as required, enum, oneOf and not, stays in
// the branch, so the schema accepts the same objects. A branch that disagrees
// with its parent keeps what conflicts and the schema stays unstructural.
func liftAllOf(s *spec.Schema) {
	branches := s.AllOf[:0]
	for _, branch := range s.AllOf {
		liftAllOf(&branch)
		mergeStructure(s, &branch)
		if !isEmptySchema(branch) {
			branches = append(branches, branch)
		}
	}
	s.AllOf = branches
	if len(s.AllOf) == 0 {
		s.AllOf = nil
	}

	for k, v := range s.Properties {
		liftAllOf(&v)
		s.Properties[k] = v
	}
	if s.AdditionalProperties != nil && s.AdditionalProperties.Schema != nil {
		liftAllOf(s.AdditionalProperties.Schema)
	}
	if s.Items != nil && s.Items.Schema != nil {
		liftAllOf(s.Items.Schema)
	}
}

// mergeStructure moves the structural fields of from into into, leaving behind
// only what into already sets differently.
func mergeStructure(into, from *spec.Schema) {
	switch {
	case len(from.Type) == 0:
	case len(into.Type) == 0:
		into.Type, from.Type = from.Type, nil
	case slices.Equal(into.Type, from.Type):
		from.Type = nil
	}
	if into.Description == "" {
		into.Description = from.Description
	}
	from.Description = ""
	if into.Title == "" {
		into.Title = from.Title
	}
	from.Title = ""
	if into.Default == nil {
		into.Default, from.Default = from.Default, nil
	}
	if from.Nullable {
		into.Nullable, from.Nullable = true, false
	}
	if from.AdditionalProperties != nil && into.AdditionalProperties == nil {
		into.AdditionalProperties, from.AdditionalProperties = from.AdditionalProperties, nil
	}
	// Expansion copies schemas shallowly, so extension maps are still shared
	// with the definitions the validator reads.
	from.Extensions = maps.Clone(from.Extensions)
	for k, v := range from.Extensions {
		if !strings.HasPrefix(k, "x-kubernetes-") {
			continue
		}
		if _, set := into.Extensions[k]; !set {
			into.Extensions = maps.Clone(into.Extensions)
			into.AddExtension(k, v)
			delete(from.Extensions, k)
		}
	}
	if len(from.Extensions) == 0 {
		from.Extensions = nil
	}
	for k, v := range from.Properties {
		existing, ok := into.Properties[k]
		if !ok {
			if into.Properties == nil {
				into.Properties = map[string]spec.Schema{}
			}
			into.Properties[k] = v
			delete(from.Properties, k)
			continue
		}
		mergeStructure(&existing, &v)
		into.Properties[k] = existing
		if isEmptySchema(v) {
			delete(from.Properties, k)
		} else {
			from.Properties[k] = v
		}
	}
	if len(from.Properties) == 0 {
		from.Properties = nil
	}
	if from.Items != nil && from.Items.Schema != nil {
		if into.Items == nil {
			into.Items, from.Items = from.Items, nil
		} else if into.Items.Schema != nil {
			mergeStructure(into.Items.Schema, from.Items.Schema)
			if isEmptySchema(*from.Items.Schema) {
				from.Items = nil
			}
		}
	}
}

func isEmptySchema(s spec.Schema) bool {
	return reflect.DeepEqual(s, spec.Schema{})
}

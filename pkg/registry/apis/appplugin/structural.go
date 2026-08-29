package appplugin

import (
	"encoding/json"
	"fmt"

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

// newKindStructuralSchema builds the structural schema pruning and defaulting
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
func newKindStructuralSchema(kindSchema spec.Schema, defs map[string]common.OpenAPIDefinition) (*structuralschema.Structural, error) {
	// Refs are expanded because a structural schema cannot carry one; the
	// validator resolves them the same way, from the same trimmed root.
	expanded := expandSchemaRefs(kindSchemaRoot(kindSchema), defs, map[string]bool{})

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
func (s *kindStore) pruneAndDefault(u *unstructured.Unstructured) {
	if s.structural == nil {
		return
	}
	// isResourceRoot, so apiVersion, kind and metadata survive a schema that
	// does not describe them -- which a manifest schema never does.
	structuralpruning.Prune(u.Object, s.structural, true)
	structuraldefaulting.Default(u.Object, s.structural)
}

package codegen

import "github.com/grafana/grafana/pkg/framework/kind"

// GenGoTypes generates Go types from the latest Thema schema in a
// structured kind.
//
// No-op for raw kinds.
type GenGoTypes struct{}

var _ SingleKindGenerator = &GenGoTypes{}

// TODO docs
type GenThemaBindings struct{}

var _ SingleKindGenerator = &GenThemaBindings{}

// TODO docs
type GenBaseRegistry struct{}

var _ MultiKindGenerator = &GenBaseRegistry{}

// TODO docs
type GenTSTypes struct{}

var _ SingleKindGenerator = &GenTSTypes{}

// TODO docs
type GenTSSchemaIndex struct{}

var _ MultiKindGenerator = &GenTSSchemaIndex{}

// GenGoServiceRefs generates a file within the service directory for a
// structured kind with predictably-named type aliases to the kind's generated
// Go types.
type GenGoServiceRefs struct{}

var _ SingleKindGenerator = &GenGoServiceRefs{}

func NewGenGoTypes() SingleKindGenerator {
	return &GenGoTypes{}
}

func (gen *GenGoTypes) Name() string {
	return "GenGoTypes"
}

func (gen *GenGoTypes) Generate(pk *kind.Parsed) (*GeneratedFile, error) {
	panic("TODO")
}

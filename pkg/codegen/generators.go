package codegen

// GenGoTypes generates Go types from the latest Thema schema in a
// structured kind.
//
// No-op for raw kinds.
type GenGoTypes struct{}

var _ KindGenerator = &GenGoTypes{}

// TODO docs
type GenThemaBindings struct{}

var _ KindGenerator = &GenThemaBindings{}

// TODO docs
type GenBaseRegistry struct{}

var _ AggregateKindGenerator = &GenBaseRegistry{}

// TODO docs
type GenTSTypes struct{}

var _ KindGenerator = &GenTSTypes{}

// TODO docs
type GenTSSchemaIndex struct{}

var _ AggregateKindGenerator = &GenTSSchemaIndex{}

// GenGoServiceRefs generates a file within the service directory for a
// structured kind with predictably-named type aliases to the kind's generated
// Go types.
type GenGoServiceRefs struct{}

var _ KindGenerator = &GenGoServiceRefs{}

func NewGenGoTypes() KindGenerator {
	return &GenGoTypes{}
}

func (gen *GenGoTypes) Name() string {
	return "GenGoTypes"
}

func (gen *GenGoTypes) Generate(decl *SomeDeclWithLineage) (*GeneratedFile, error) {
	panic("TODO")
}

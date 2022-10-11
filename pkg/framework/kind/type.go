package kind

import "github.com/grafana/thema"

// TODO generate from type.cue
type RawMeta struct {
	Extensions []string
	Maturity   Maturity
}

func (m RawMeta) _private() {}

// TODO
type CoreStructuredMeta struct {
	CurrentVersion thema.SyntacticVersion
	Maturity       Maturity
}

func (m CoreStructuredMeta) _private() {}

// TODO
type CustomStructuredMeta struct {
	CurrentVersion thema.SyntacticVersion
	Maturity       Maturity
}

func (m CustomStructuredMeta) _private() {}

// TODO
// type SlotImplMeta struct {
// }

// SomeKindMeta is an interface type to abstract over the different kind
// metadata struct types: [RawMeta], [CoreStructuredMeta],
// [CustomStructuredMeta].
//
// It is the traditional interface counterpart to the generic type constraint
// KindMetas.
type SomeKindMeta interface {
	_private()
}

// KindMetas is a type parameter that comprises the base possible set of
// kind metadata configurations.
type KindMetas = interface {
	RawMeta | CoreStructuredMeta | CustomStructuredMeta // | SlotImplMeta
}

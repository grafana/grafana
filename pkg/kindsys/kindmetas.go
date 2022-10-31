package kindsys

import "github.com/grafana/thema"

// TODO generate from type.cue
type RawMeta struct {
	Name              string   `json:"name"`
	PluralName        string   `json:"pluralName"`
	MachineName       string   `json:"machineName"`
	PluralMachineName string   `json:"pluralMachineName"`
	Extensions        []string `json:"extensions"`
	Maturity          Maturity `json:"maturity"`
}

func (m RawMeta) _private() {}

// TODO
type CoreStructuredMeta struct {
	Name              string                 `json:"name"`
	PluralName        string                 `json:"pluralName"`
	MachineName       string                 `json:"machineName"`
	PluralMachineName string                 `json:"pluralMachineName"`
	CurrentVersion    thema.SyntacticVersion `json:"currentVersion"`
	Maturity          Maturity               `json:"maturity"`
}

func (m CoreStructuredMeta) _private() {}

// TODO
type CustomStructuredMeta struct {
	Name              string                 `json:"name"`
	PluralName        string                 `json:"pluralName"`
	MachineName       string                 `json:"machineName"`
	PluralMachineName string                 `json:"pluralMachineName"`
	CurrentVersion    thema.SyntacticVersion `json:"currentVersion"`
	Maturity          Maturity               `json:"maturity"`
}

func (m CustomStructuredMeta) _private() {}

// TODO
type ComposableMeta struct {
	Name              string                 `json:"name"`
	PluralName        string                 `json:"pluralName"`
	MachineName       string                 `json:"machineName"`
	PluralMachineName string                 `json:"pluralMachineName"`
	CurrentVersion    thema.SyntacticVersion `json:"currentVersion"`
	Maturity          Maturity               `json:"maturity"`
}

func (m ComposableMeta) _private() {}

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
type KindMetas interface {
	RawMeta | CoreStructuredMeta | CustomStructuredMeta | ComposableMeta
}

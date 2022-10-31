package kindsys

import (
	"path/filepath"

	"github.com/grafana/thema"
)

// TODO docs
type Maturity string

const (
	MaturityCommitted    Maturity = "committed"
	MaturitySynchronized Maturity = "synchronized"
	MaturityStable       Maturity = "stable"
	MaturityMature       Maturity = "mature"
)

// TODO docs
type Interface interface {
	// TODO docs
	Name() string

	// TODO docs
	MachineName() string

	// TODO docs
	Maturity() Maturity // TODO unclear if we want maturity for raw kinds
}

// TODO docs
type Raw interface {
	Interface

	// TODO docs
	Meta() RawMeta
}

type Structured interface {
	Interface

	// TODO docs
	Lineage() thema.Lineage

	// TODO docs
	Meta() CoreStructuredMeta // TODO figure out how to reconcile this interface with CustomStructuredMeta
}

// type Composable interface {
// 	Interface
//
// 	// TODO docs
// 	Lineage() thema.Lineage
//
// 	// TODO docs
// 	Meta() CoreStructuredMeta // TODO figure out how to reconcile this interface with CustomStructuredMeta
// }

// CoreStructuredDeclParentPath is the path, relative to the repository root, where
// each child directory is expected to contain .cue files declaring one
// CoreStructured kind.
var CoreStructuredDeclParentPath = filepath.Join("kinds", "structured")

// RawDeclParentPath is the path, relative to the repository root, where each child
// directory is expected to contain .cue files declaring one Raw kind.
var RawDeclParentPath = filepath.Join("kinds", "raw")

// GoCoreKindParentPath is the path, relative to the repository root, to the directory
// containing one directory per kind, full of generated Go kind output: types and bindings.
var GoCoreKindParentPath = filepath.Join("pkg", "kinds")

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

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

// type SlotImplementation interface {
// 	Interface
//
// 	// TODO docs
// 	Lineage() thema.Lineage
//
// 	// TODO docs
// 	Meta() SlotImplMeta
// }

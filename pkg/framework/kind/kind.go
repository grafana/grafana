package kind

import "github.com/grafana/thema"

// TODO docs
type Maturity string

const (
	MaturityCommitted    Maturity = "committed"
	MaturitySynchronized Maturity = "synchronized"
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

// type SlotImplementation interface {
// 	Interface
//
// 	// TODO docs
// 	Lineage() thema.Lineage
//
// 	// TODO docs
// 	Meta() SlotImplMeta
// }

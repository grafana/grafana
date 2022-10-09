package entity

import "github.com/grafana/thema"

// TODO
type StructuredMaturity string

const (
	MaturityCommitted    StructuredMaturity = "committed"
	MaturitySynchronized StructuredMaturity = "synchronized"
	MaturityMature       StructuredMaturity = "mature"
)

// TODO
type Interface interface {
	// TODO
	Name() string

	// TODO
	Maturity() StructuredMaturity
}

// TODO
type RawKind interface {
	Interface

	// TODO
	Meta() RawMeta
}

type CoreStructuredKind[T thema.Assignee] interface {
	Interface

	// TODO
	Lineage() thema.ConvergentLineage[T]

	// TODO
	Meta() CoreStructuredMeta
}

type CustomStructuredKind interface {
	Interface

	// TODO
	Lineage() thema.Lineage

	// TODO
	Meta() CustomStructuredMeta
}

type SlotImplementation interface {
	Interface

	// TODO
	Lineage() thema.Lineage

	// TODO
	Meta() SlotImplMeta
}

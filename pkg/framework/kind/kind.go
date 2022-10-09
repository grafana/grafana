package kind

import "github.com/grafana/thema"

// TODO
type Maturity string

const (
	MaturityCommitted    Maturity = "committed"
	MaturitySynchronized Maturity = "synchronized"
	MaturityMature       Maturity = "mature"
)

// TODO
type Interface interface {
	// TODO
	Name() string

	// TODO
	Maturity() Maturity
}

// TODO
type Raw interface {
	Interface

	// TODO
	Meta() RawMeta
}

type CoreStructured[T thema.Assignee] interface {
	Interface

	// TODO
	Lineage() thema.ConvergentLineage[T]

	// TODO
	Meta() CoreStructuredMeta
}

type CustomStructured interface {
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

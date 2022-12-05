package kindsys

import (
	"fmt"

	"github.com/grafana/thema"
)

// TODO docs
type Maturity string

const (
	MaturityMerged       Maturity = "merged"
	MaturityExperimental Maturity = "experimental"
	MaturityStable       Maturity = "stable"
	MaturityMature       Maturity = "mature"
)

func maturityIdx(m Maturity) int {
	// icky to do this globally, this is effectively setting a default
	if string(m) == "" {
		m = MaturityMerged
	}

	for i, ms := range maturityOrder {
		if m == ms {
			return i
		}
	}
	panic(fmt.Sprintf("unknown maturity milestone %s", m))
}

var maturityOrder = []Maturity{
	MaturityMerged,
	MaturityExperimental,
	MaturityStable,
	MaturityMature,
}

func (m Maturity) Less(om Maturity) bool {
	return maturityIdx(m) < maturityIdx(om)
}

func (m Maturity) String() string {
	return string(m)
}

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
	Decl() *Decl[RawMeta]
}

type Structured interface {
	Interface

	// TODO docs
	Lineage() thema.Lineage

	// TODO docs
	Decl() *Decl[CoreStructuredMeta] // TODO figure out how to reconcile this interface with CustomStructuredMeta
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

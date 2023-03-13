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

// Kind describes a Grafana kind object: a Go representation of the definition of
// one of Grafana's categories of kinds.
type Kind interface {
	// Props returns a [kindsys.SomeKindProps], representing the properties
	// of the kind as declared in the .cue source. The underlying type is
	// determined by the category of kind.
	//
	// This method is largely for convenience, as all actual kind categories are
	// expected to implement one of the other interfaces, each of which contain
	// a Def() method through which these same properties are accessible.
	Props() SomeKindProperties

	// TODO docs
	Lineage() thema.Lineage

	// TODO remove, unnecessary with Props()
	Name() string

	// TODO remove, unnecessary with Props()
	MachineName() string

	// TODO remove, unnecessary with Props()
	Maturity() Maturity // TODO unclear if we want maturity for raw kinds
}

type Core interface {
	Kind

	// TODO docs
	Def() Def[CoreProperties]
}

type Custom interface {
	Kind

	// TODO docs
	Def() Def[CustomProperties]
}

type Composable interface {
	Kind

	// TODO docs
	Def() Def[ComposableProperties]
}

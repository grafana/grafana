package kindsys

import (
	"github.com/grafana/thema"
)

var _ Composable = genericComposable{}

type genericComposable struct {
	def Def[ComposableProperties]
	lin thema.Lineage
}

func (k genericComposable) Props() SomeKindProperties {
	return k.def.Properties
}

func (k genericComposable) Name() string {
	return k.def.Properties.Name
}

func (k genericComposable) MachineName() string {
	return k.def.Properties.MachineName
}

func (k genericComposable) Maturity() Maturity {
	return k.def.Properties.Maturity
}

func (k genericComposable) Def() Def[ComposableProperties] {
	return k.def
}

func (k genericComposable) Lineage() thema.Lineage {
	return k.lin
}

func BindComposable(rt *thema.Runtime, decl Def[ComposableProperties], opts ...thema.BindOption) (Composable, error) {
	lin, err := decl.Some().BindKindLineage(rt, opts...)
	if err != nil {
		return nil, err
	}

	return genericComposable{
		def: decl,
		lin: lin,
	}, nil
}

package kindsys

import (
	"github.com/grafana/thema"
)

var _ Composable = genericComposable{}

type genericComposable struct {
	decl Decl[ComposableProperties]
	lin  thema.Lineage
}

func (k genericComposable) Props() SomeKindProperties {
	return k.decl.Properties
}

func (k genericComposable) Name() string {
	return k.decl.Properties.Name
}

func (k genericComposable) MachineName() string {
	return k.decl.Properties.MachineName
}

func (k genericComposable) Maturity() Maturity {
	return k.decl.Properties.Maturity
}

func (k genericComposable) Decl() Decl[ComposableProperties] {
	return k.decl
}

func (k genericComposable) Lineage() thema.Lineage {
	return k.lin
}

func BindComposable(rt *thema.Runtime, decl Decl[ComposableProperties], opts ...thema.BindOption) (Composable, error) {
	lin, err := decl.Some().BindKindLineage(rt, opts...)
	if err != nil {
		return nil, err
	}

	return genericComposable{
		decl: decl,
		lin:  lin,
	}, nil
}

package kinds

import (
	"context"

	"github.com/grafana/kindsys"
)

type Registry interface {
	Core(ctx context.Context) []kindsys.Core
	Custom(ctx context.Context) []kindsys.Custom
	Composable(ctx context.Context) []kindsys.Composable
	All(ctx context.Context) []kindsys.Kind
	Register(ctx context.Context, p *kindsys.Provider)
	Unregister(ctx context.Context, p *kindsys.Provider)
}

func ProvideService() Registry {
	return NewRegistry()
}

func NewRegistry() Registry {
	return &registry{
		all: []*kindsys.Provider{},
	}
}

type registry struct {
	all []*kindsys.Provider
}

func (r *registry) Core(ctx context.Context) []kindsys.Core {
	kinds := []kindsys.Core{}

	for _, pa := range r.all {
		for _, ck := range pa.CoreKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (r *registry) Custom(ctx context.Context) []kindsys.Custom {
	kinds := []kindsys.Custom{}

	for _, pa := range r.all {
		for _, ck := range pa.CustomKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (r *registry) Composable(ctx context.Context) []kindsys.Composable {
	kinds := []kindsys.Composable{}

	for _, pa := range r.all {
		for _, ck := range pa.ComposableKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (r *registry) All(ctx context.Context) []kindsys.Kind {
	kinds := []kindsys.Kind{}

	for _, pa := range r.all {
		for _, ck := range pa.ComposableKinds {
			kinds = append(kinds, ck)
		}

		for _, ck := range pa.CoreKinds {
			kinds = append(kinds, ck)
		}

		for _, ck := range pa.CustomKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (r *registry) Register(ctx context.Context, p *kindsys.Provider) {
	r.all = append(r.all, p)
}

func (r *registry) Unregister(ctx context.Context, p *kindsys.Provider) {
	all := []*kindsys.Provider{}

	for _, pa := range r.all {
		if p.Name != pa.Name {
			all = append(all, pa)
		}
	}

	r.all = all
}

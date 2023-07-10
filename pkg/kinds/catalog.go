package kinds

import (
	"context"

	"github.com/grafana/kindsys"
)

type Catalog interface {
	CoreKinds(ctx context.Context) []kindsys.Core
	CustomKinds(ctx context.Context) []kindsys.Custom
	ComposableKinds(ctx context.Context) []kindsys.Composable
	AllKinds(ctx context.Context) []kindsys.Kind
	AllProviders(ctx context.Context) []kindsys.Provider
	Register(ctx context.Context, p *kindsys.Provider)
	Unregister(ctx context.Context, p *kindsys.Provider)
}

func NewCatalog() Catalog {
	return &registry{
		providers: []*kindsys.Provider{},
	}
}

type registry struct {
	providers []*kindsys.Provider
}

func (r *registry) CoreKinds(ctx context.Context) []kindsys.Core {
	kinds := []kindsys.Core{}

	for _, pa := range r.providers {
		for _, ck := range pa.CoreKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (r *registry) CustomKinds(ctx context.Context) []kindsys.Custom {
	kinds := []kindsys.Custom{}

	for _, pa := range r.providers {
		for _, ck := range pa.CustomKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (r *registry) ComposableKinds(ctx context.Context) []kindsys.Composable {
	kinds := []kindsys.Composable{}

	for _, pa := range r.providers {
		for _, ck := range pa.ComposableKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (r *registry) AllKinds(ctx context.Context) []kindsys.Kind {
	kinds := []kindsys.Kind{}

	for _, pa := range r.providers {
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

func (r *registry) AllProviders(ctx context.Context) []kindsys.Provider {
	providers := make([]kindsys.Provider, len(r.providers))
	for idx, pa := range r.providers {
		providers[idx] = *pa
	}
	return providers
}

func (r *registry) Register(ctx context.Context, p *kindsys.Provider) {
	r.providers = append(r.providers, p)
}

func (r *registry) Unregister(ctx context.Context, p *kindsys.Provider) {
	all := []*kindsys.Provider{}

	for _, pa := range r.providers {
		if p.Name != pa.Name {
			all = append(all, pa)
		}
	}

	r.providers = all
}

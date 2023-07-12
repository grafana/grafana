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
	return &catalog{
		providers: []*kindsys.Provider{},
	}
}

type catalog struct {
	providers []*kindsys.Provider
}

func (c *catalog) CoreKinds(ctx context.Context) []kindsys.Core {
	kinds := []kindsys.Core{}

	for _, pa := range c.providers {
		for _, ck := range pa.CoreKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (c *catalog) CustomKinds(ctx context.Context) []kindsys.Custom {
	kinds := []kindsys.Custom{}

	for _, pa := range c.providers {
		for _, ck := range pa.CustomKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (c *catalog) ComposableKinds(ctx context.Context) []kindsys.Composable {
	kinds := []kindsys.Composable{}

	for _, pa := range c.providers {
		for _, ck := range pa.ComposableKinds {
			kinds = append(kinds, ck)
		}
	}

	return kinds
}

func (c *catalog) AllKinds(ctx context.Context) []kindsys.Kind {
	kinds := []kindsys.Kind{}

	for _, pa := range c.providers {
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

func (c *catalog) AllProviders(ctx context.Context) []kindsys.Provider {
	providers := make([]kindsys.Provider, len(c.providers))
	for idx, pa := range c.providers {
		providers[idx] = *pa
	}
	return providers
}

func (c *catalog) Register(ctx context.Context, p *kindsys.Provider) {
	c.providers = append(c.providers, p)
}

func (c *catalog) Unregister(ctx context.Context, p *kindsys.Provider) {
	all := []*kindsys.Provider{}

	for _, pa := range c.providers {
		if p.Name != pa.Name {
			all = append(all, pa)
		}
	}

	c.providers = all
}

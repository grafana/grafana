package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type PaletteClient struct {
	client *resource.TypedClient[*Palette, *PaletteList]
}

func NewPaletteClient(client resource.Client) *PaletteClient {
	return &PaletteClient{
		client: resource.NewTypedClient[*Palette, *PaletteList](client, PaletteKind()),
	}
}

func NewPaletteClientFromGenerator(generator resource.ClientGenerator) (*PaletteClient, error) {
	c, err := generator.ClientFor(PaletteKind())
	if err != nil {
		return nil, err
	}
	return NewPaletteClient(c), nil
}

func (c *PaletteClient) Get(ctx context.Context, identifier resource.Identifier) (*Palette, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PaletteClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PaletteList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PaletteClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PaletteList, error) {
	resp, err := c.client.List(ctx, namespace, resource.ListOptions{
		ResourceVersion: opts.ResourceVersion,
		Limit:           opts.Limit,
		LabelFilters:    opts.LabelFilters,
		FieldSelectors:  opts.FieldSelectors,
	})
	if err != nil {
		return nil, err
	}
	for resp.GetContinue() != "" {
		page, err := c.client.List(ctx, namespace, resource.ListOptions{
			Continue:        resp.GetContinue(),
			ResourceVersion: opts.ResourceVersion,
			Limit:           opts.Limit,
			LabelFilters:    opts.LabelFilters,
			FieldSelectors:  opts.FieldSelectors,
		})
		if err != nil {
			return nil, err
		}
		resp.SetContinue(page.GetContinue())
		resp.SetResourceVersion(page.GetResourceVersion())
		resp.SetItems(append(resp.GetItems(), page.GetItems()...))
	}
	return resp, nil
}

func (c *PaletteClient) Create(ctx context.Context, obj *Palette, opts resource.CreateOptions) (*Palette, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PaletteKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PaletteClient) Update(ctx context.Context, obj *Palette, opts resource.UpdateOptions) (*Palette, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PaletteClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Palette, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PaletteClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

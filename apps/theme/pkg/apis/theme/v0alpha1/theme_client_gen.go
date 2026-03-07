package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ThemeClient struct {
	client *resource.TypedClient[*Theme, *ThemeList]
}

func NewThemeClient(client resource.Client) *ThemeClient {
	return &ThemeClient{
		client: resource.NewTypedClient[*Theme, *ThemeList](client, ThemeKind()),
	}
}

func NewThemeClientFromGenerator(generator resource.ClientGenerator) (*ThemeClient, error) {
	c, err := generator.ClientFor(ThemeKind())
	if err != nil {
		return nil, err
	}
	return NewThemeClient(c), nil
}

func (c *ThemeClient) Get(ctx context.Context, identifier resource.Identifier) (*Theme, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ThemeClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ThemeList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ThemeClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ThemeList, error) {
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

func (c *ThemeClient) Create(ctx context.Context, obj *Theme, opts resource.CreateOptions) (*Theme, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ThemeKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ThemeClient) Update(ctx context.Context, obj *Theme, opts resource.UpdateOptions) (*Theme, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ThemeClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Theme, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ThemeClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

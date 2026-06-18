package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type AppClient struct {
	client *resource.TypedClient[*App, *AppList]
}

func NewAppClient(client resource.Client) *AppClient {
	return &AppClient{
		client: resource.NewTypedClient[*App, *AppList](client, AppKind()),
	}
}

func NewAppClientFromGenerator(generator resource.ClientGenerator) (*AppClient, error) {
	c, err := generator.ClientFor(AppKind())
	if err != nil {
		return nil, err
	}
	return NewAppClient(c), nil
}

func (c *AppClient) Get(ctx context.Context, identifier resource.Identifier) (*App, error) {
	return c.client.Get(ctx, identifier)
}

func (c *AppClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*AppList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *AppClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*AppList, error) {
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

func (c *AppClient) Create(ctx context.Context, obj *App, opts resource.CreateOptions) (*App, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = AppKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *AppClient) Update(ctx context.Context, obj *App, opts resource.UpdateOptions) (*App, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *AppClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*App, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *AppClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

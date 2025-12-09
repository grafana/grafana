package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type QueryClient struct {
	client *resource.TypedClient[*Query, *QueryList]
}

func NewQueryClient(client resource.Client) *QueryClient {
	return &QueryClient{
		client: resource.NewTypedClient[*Query, *QueryList](client, QueryKind()),
	}
}

func NewQueryClientFromGenerator(generator resource.ClientGenerator) (*QueryClient, error) {
	c, err := generator.ClientFor(QueryKind())
	if err != nil {
		return nil, err
	}
	return NewQueryClient(c), nil
}

func (c *QueryClient) Get(ctx context.Context, identifier resource.Identifier) (*Query, error) {
	return c.client.Get(ctx, identifier)
}

func (c *QueryClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*QueryList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *QueryClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*QueryList, error) {
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

func (c *QueryClient) Create(ctx context.Context, obj *Query, opts resource.CreateOptions) (*Query, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = QueryKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *QueryClient) Update(ctx context.Context, obj *Query, opts resource.UpdateOptions) (*Query, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *QueryClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Query, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *QueryClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

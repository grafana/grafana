package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type DataSourceStackClient struct {
	client *resource.TypedClient[*DataSourceStack, *DataSourceStackList]
}

func NewDataSourceStackClient(client resource.Client) *DataSourceStackClient {
	return &DataSourceStackClient{
		client: resource.NewTypedClient[*DataSourceStack, *DataSourceStackList](client, DataSourceStackKind()),
	}
}

func NewDataSourceStackClientFromGenerator(generator resource.ClientGenerator) (*DataSourceStackClient, error) {
	c, err := generator.ClientFor(DataSourceStackKind())
	if err != nil {
		return nil, err
	}
	return NewDataSourceStackClient(c), nil
}

func (c *DataSourceStackClient) Get(ctx context.Context, identifier resource.Identifier) (*DataSourceStack, error) {
	return c.client.Get(ctx, identifier)
}

func (c *DataSourceStackClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*DataSourceStackList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *DataSourceStackClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*DataSourceStackList, error) {
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

func (c *DataSourceStackClient) Create(ctx context.Context, obj *DataSourceStack, opts resource.CreateOptions) (*DataSourceStack, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = DataSourceStackKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *DataSourceStackClient) Update(ctx context.Context, obj *DataSourceStack, opts resource.UpdateOptions) (*DataSourceStack, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *DataSourceStackClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*DataSourceStack, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *DataSourceStackClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

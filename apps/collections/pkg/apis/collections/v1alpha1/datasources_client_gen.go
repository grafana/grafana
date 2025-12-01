package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type DatasourcesClient struct {
	client *resource.TypedClient[*Datasources, *DatasourcesList]
}

func NewDatasourcesClient(client resource.Client) *DatasourcesClient {
	return &DatasourcesClient{
		client: resource.NewTypedClient[*Datasources, *DatasourcesList](client, DatasourcesKind()),
	}
}

func NewDatasourcesClientFromGenerator(generator resource.ClientGenerator) (*DatasourcesClient, error) {
	c, err := generator.ClientFor(DatasourcesKind())
	if err != nil {
		return nil, err
	}
	return NewDatasourcesClient(c), nil
}

func (c *DatasourcesClient) Get(ctx context.Context, identifier resource.Identifier) (*Datasources, error) {
	return c.client.Get(ctx, identifier)
}

func (c *DatasourcesClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*DatasourcesList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *DatasourcesClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*DatasourcesList, error) {
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

func (c *DatasourcesClient) Create(ctx context.Context, obj *Datasources, opts resource.CreateOptions) (*Datasources, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = DatasourcesKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *DatasourcesClient) Update(ctx context.Context, obj *Datasources, opts resource.UpdateOptions) (*Datasources, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *DatasourcesClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Datasources, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *DatasourcesClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

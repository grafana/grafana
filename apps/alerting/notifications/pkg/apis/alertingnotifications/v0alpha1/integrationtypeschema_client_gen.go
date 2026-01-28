package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type IntegrationTypeSchemaClient struct {
	client *resource.TypedClient[*IntegrationTypeSchema, *IntegrationTypeSchemaList]
}

func NewIntegrationTypeSchemaClient(client resource.Client) *IntegrationTypeSchemaClient {
	return &IntegrationTypeSchemaClient{
		client: resource.NewTypedClient[*IntegrationTypeSchema, *IntegrationTypeSchemaList](client, IntegrationTypeSchemaKind()),
	}
}

func NewIntegrationTypeSchemaClientFromGenerator(generator resource.ClientGenerator) (*IntegrationTypeSchemaClient, error) {
	c, err := generator.ClientFor(IntegrationTypeSchemaKind())
	if err != nil {
		return nil, err
	}
	return NewIntegrationTypeSchemaClient(c), nil
}

func (c *IntegrationTypeSchemaClient) Get(ctx context.Context, identifier resource.Identifier) (*IntegrationTypeSchema, error) {
	return c.client.Get(ctx, identifier)
}

func (c *IntegrationTypeSchemaClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*IntegrationTypeSchemaList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *IntegrationTypeSchemaClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*IntegrationTypeSchemaList, error) {
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

func (c *IntegrationTypeSchemaClient) Create(ctx context.Context, obj *IntegrationTypeSchema, opts resource.CreateOptions) (*IntegrationTypeSchema, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = IntegrationTypeSchemaKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *IntegrationTypeSchemaClient) Update(ctx context.Context, obj *IntegrationTypeSchema, opts resource.UpdateOptions) (*IntegrationTypeSchema, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *IntegrationTypeSchemaClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*IntegrationTypeSchema, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *IntegrationTypeSchemaClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ExternalGroupMappingClient struct {
	client *resource.TypedClient[*ExternalGroupMapping, *ExternalGroupMappingList]
}

func NewExternalGroupMappingClient(client resource.Client) *ExternalGroupMappingClient {
	return &ExternalGroupMappingClient{
		client: resource.NewTypedClient[*ExternalGroupMapping, *ExternalGroupMappingList](client, ExternalGroupMappingKind()),
	}
}

func NewExternalGroupMappingClientFromGenerator(generator resource.ClientGenerator) (*ExternalGroupMappingClient, error) {
	c, err := generator.ClientFor(ExternalGroupMappingKind())
	if err != nil {
		return nil, err
	}
	return NewExternalGroupMappingClient(c), nil
}

func (c *ExternalGroupMappingClient) Get(ctx context.Context, identifier resource.Identifier) (*ExternalGroupMapping, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ExternalGroupMappingClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ExternalGroupMappingList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ExternalGroupMappingClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ExternalGroupMappingList, error) {
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

func (c *ExternalGroupMappingClient) Create(ctx context.Context, obj *ExternalGroupMapping, opts resource.CreateOptions) (*ExternalGroupMapping, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ExternalGroupMappingKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ExternalGroupMappingClient) Update(ctx context.Context, obj *ExternalGroupMapping, opts resource.UpdateOptions) (*ExternalGroupMapping, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ExternalGroupMappingClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ExternalGroupMapping, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ExternalGroupMappingClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type CoreRoleClient struct {
	client *resource.TypedClient[*CoreRole, *CoreRoleList]
}

func NewCoreRoleClient(client resource.Client) *CoreRoleClient {
	return &CoreRoleClient{
		client: resource.NewTypedClient[*CoreRole, *CoreRoleList](client, CoreRoleKind()),
	}
}

func NewCoreRoleClientFromGenerator(generator resource.ClientGenerator) (*CoreRoleClient, error) {
	c, err := generator.ClientFor(CoreRoleKind())
	if err != nil {
		return nil, err
	}
	return NewCoreRoleClient(c), nil
}

func (c *CoreRoleClient) Get(ctx context.Context, identifier resource.Identifier) (*CoreRole, error) {
	return c.client.Get(ctx, identifier)
}

func (c *CoreRoleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*CoreRoleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *CoreRoleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*CoreRoleList, error) {
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

func (c *CoreRoleClient) Create(ctx context.Context, obj *CoreRole, opts resource.CreateOptions) (*CoreRole, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = CoreRoleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *CoreRoleClient) Update(ctx context.Context, obj *CoreRole, opts resource.UpdateOptions) (*CoreRole, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *CoreRoleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*CoreRole, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *CoreRoleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

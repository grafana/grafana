package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ResourcePermissionClient struct {
	client *resource.TypedClient[*ResourcePermission, *ResourcePermissionList]
}

func NewResourcePermissionClient(client resource.Client) *ResourcePermissionClient {
	return &ResourcePermissionClient{
		client: resource.NewTypedClient[*ResourcePermission, *ResourcePermissionList](client, ResourcePermissionKind()),
	}
}

func NewResourcePermissionClientFromGenerator(generator resource.ClientGenerator) (*ResourcePermissionClient, error) {
	c, err := generator.ClientFor(ResourcePermissionKind())
	if err != nil {
		return nil, err
	}
	return NewResourcePermissionClient(c), nil
}

func (c *ResourcePermissionClient) Get(ctx context.Context, identifier resource.Identifier) (*ResourcePermission, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ResourcePermissionClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ResourcePermissionList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ResourcePermissionClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ResourcePermissionList, error) {
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

func (c *ResourcePermissionClient) Create(ctx context.Context, obj *ResourcePermission, opts resource.CreateOptions) (*ResourcePermission, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ResourcePermissionKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ResourcePermissionClient) Update(ctx context.Context, obj *ResourcePermission, opts resource.UpdateOptions) (*ResourcePermission, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ResourcePermissionClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ResourcePermission, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ResourcePermissionClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type RoleClient struct {
	client *resource.TypedClient[*Role, *RoleList]
}

func NewRoleClient(client resource.Client) *RoleClient {
	return &RoleClient{
		client: resource.NewTypedClient[*Role, *RoleList](client, RoleKind()),
	}
}

func NewRoleClientFromGenerator(generator resource.ClientGenerator) (*RoleClient, error) {
	c, err := generator.ClientFor(RoleKind())
	if err != nil {
		return nil, err
	}
	return NewRoleClient(c), nil
}

func (c *RoleClient) Get(ctx context.Context, identifier resource.Identifier) (*Role, error) {
	return c.client.Get(ctx, identifier)
}

func (c *RoleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*RoleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *RoleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*RoleList, error) {
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

func (c *RoleClient) Create(ctx context.Context, obj *Role, opts resource.CreateOptions) (*Role, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = RoleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *RoleClient) Update(ctx context.Context, obj *Role, opts resource.UpdateOptions) (*Role, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *RoleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Role, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *RoleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

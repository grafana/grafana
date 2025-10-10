package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type RoleBindingClient struct {
	client *resource.TypedClient[*RoleBinding, *RoleBindingList]
}

func NewRoleBindingClient(client resource.Client) *RoleBindingClient {
	return &RoleBindingClient{
		client: resource.NewTypedClient[*RoleBinding, *RoleBindingList](client, RoleBindingKind()),
	}
}

func NewRoleBindingClientFromGenerator(generator resource.ClientGenerator) (*RoleBindingClient, error) {
	c, err := generator.ClientFor(RoleBindingKind())
	if err != nil {
		return nil, err
	}
	return NewRoleBindingClient(c), nil
}

func (c *RoleBindingClient) Get(ctx context.Context, identifier resource.Identifier) (*RoleBinding, error) {
	return c.client.Get(ctx, identifier)
}

func (c *RoleBindingClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*RoleBindingList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *RoleBindingClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*RoleBindingList, error) {
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

func (c *RoleBindingClient) Create(ctx context.Context, obj *RoleBinding, opts resource.CreateOptions) (*RoleBinding, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = RoleBindingKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *RoleBindingClient) Update(ctx context.Context, obj *RoleBinding, opts resource.UpdateOptions) (*RoleBinding, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *RoleBindingClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*RoleBinding, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *RoleBindingClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

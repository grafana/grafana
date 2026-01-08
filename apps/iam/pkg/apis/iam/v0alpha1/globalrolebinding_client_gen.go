package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type GlobalRoleBindingClient struct {
	client *resource.TypedClient[*GlobalRoleBinding, *GlobalRoleBindingList]
}

func NewGlobalRoleBindingClient(client resource.Client) *GlobalRoleBindingClient {
	return &GlobalRoleBindingClient{
		client: resource.NewTypedClient[*GlobalRoleBinding, *GlobalRoleBindingList](client, GlobalRoleBindingKind()),
	}
}

func NewGlobalRoleBindingClientFromGenerator(generator resource.ClientGenerator) (*GlobalRoleBindingClient, error) {
	c, err := generator.ClientFor(GlobalRoleBindingKind())
	if err != nil {
		return nil, err
	}
	return NewGlobalRoleBindingClient(c), nil
}

func (c *GlobalRoleBindingClient) Get(ctx context.Context, identifier resource.Identifier) (*GlobalRoleBinding, error) {
	return c.client.Get(ctx, identifier)
}

func (c *GlobalRoleBindingClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*GlobalRoleBindingList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *GlobalRoleBindingClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*GlobalRoleBindingList, error) {
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

func (c *GlobalRoleBindingClient) Create(ctx context.Context, obj *GlobalRoleBinding, opts resource.CreateOptions) (*GlobalRoleBinding, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = GlobalRoleBindingKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *GlobalRoleBindingClient) Update(ctx context.Context, obj *GlobalRoleBinding, opts resource.UpdateOptions) (*GlobalRoleBinding, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *GlobalRoleBindingClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*GlobalRoleBinding, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *GlobalRoleBindingClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

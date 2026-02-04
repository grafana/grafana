package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type RoutingTreeClient struct {
	client *resource.TypedClient[*RoutingTree, *RoutingTreeList]
}

func NewRoutingTreeClient(client resource.Client) *RoutingTreeClient {
	return &RoutingTreeClient{
		client: resource.NewTypedClient[*RoutingTree, *RoutingTreeList](client, RoutingTreeKind()),
	}
}

func NewRoutingTreeClientFromGenerator(generator resource.ClientGenerator) (*RoutingTreeClient, error) {
	c, err := generator.ClientFor(RoutingTreeKind())
	if err != nil {
		return nil, err
	}
	return NewRoutingTreeClient(c), nil
}

func (c *RoutingTreeClient) Get(ctx context.Context, identifier resource.Identifier) (*RoutingTree, error) {
	return c.client.Get(ctx, identifier)
}

func (c *RoutingTreeClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*RoutingTreeList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *RoutingTreeClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*RoutingTreeList, error) {
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

func (c *RoutingTreeClient) Create(ctx context.Context, obj *RoutingTree, opts resource.CreateOptions) (*RoutingTree, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = RoutingTreeKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *RoutingTreeClient) Update(ctx context.Context, obj *RoutingTree, opts resource.UpdateOptions) (*RoutingTree, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *RoutingTreeClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*RoutingTree, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *RoutingTreeClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v2

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type VariableClient struct {
	client *resource.TypedClient[*Variable, *VariableList]
}

func NewVariableClient(client resource.Client) *VariableClient {
	return &VariableClient{
		client: resource.NewTypedClient[*Variable, *VariableList](client, VariableKind()),
	}
}

func NewVariableClientFromGenerator(generator resource.ClientGenerator) (*VariableClient, error) {
	c, err := generator.ClientFor(VariableKind())
	if err != nil {
		return nil, err
	}
	return NewVariableClient(c), nil
}

func (c *VariableClient) Get(ctx context.Context, identifier resource.Identifier) (*Variable, error) {
	return c.client.Get(ctx, identifier)
}

func (c *VariableClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*VariableList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *VariableClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*VariableList, error) {
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

func (c *VariableClient) Create(ctx context.Context, obj *Variable, opts resource.CreateOptions) (*Variable, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = VariableKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *VariableClient) Update(ctx context.Context, obj *Variable, opts resource.UpdateOptions) (*Variable, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *VariableClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Variable, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *VariableClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

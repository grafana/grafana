package v2beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type GlobalVariableClient struct {
	client *resource.TypedClient[*GlobalVariable, *GlobalVariableList]
}

func NewGlobalVariableClient(client resource.Client) *GlobalVariableClient {
	return &GlobalVariableClient{
		client: resource.NewTypedClient[*GlobalVariable, *GlobalVariableList](client, GlobalVariableKind()),
	}
}

func NewGlobalVariableClientFromGenerator(generator resource.ClientGenerator) (*GlobalVariableClient, error) {
	c, err := generator.ClientFor(GlobalVariableKind())
	if err != nil {
		return nil, err
	}
	return NewGlobalVariableClient(c), nil
}

func (c *GlobalVariableClient) Get(ctx context.Context, identifier resource.Identifier) (*GlobalVariable, error) {
	return c.client.Get(ctx, identifier)
}

func (c *GlobalVariableClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*GlobalVariableList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *GlobalVariableClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*GlobalVariableList, error) {
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

func (c *GlobalVariableClient) Create(ctx context.Context, obj *GlobalVariable, opts resource.CreateOptions) (*GlobalVariable, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = GlobalVariableKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *GlobalVariableClient) Update(ctx context.Context, obj *GlobalVariable, opts resource.UpdateOptions) (*GlobalVariable, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *GlobalVariableClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*GlobalVariable, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *GlobalVariableClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type FindScopeNavigationsResultsClient struct {
	client *resource.TypedClient[*FindScopeNavigationsResults, *FindScopeNavigationsResultsList]
}

func NewFindScopeNavigationsResultsClient(client resource.Client) *FindScopeNavigationsResultsClient {
	return &FindScopeNavigationsResultsClient{
		client: resource.NewTypedClient[*FindScopeNavigationsResults, *FindScopeNavigationsResultsList](client, FindScopeNavigationsResultsKind()),
	}
}

func NewFindScopeNavigationsResultsClientFromGenerator(generator resource.ClientGenerator) (*FindScopeNavigationsResultsClient, error) {
	c, err := generator.ClientFor(FindScopeNavigationsResultsKind())
	if err != nil {
		return nil, err
	}
	return NewFindScopeNavigationsResultsClient(c), nil
}

func (c *FindScopeNavigationsResultsClient) Get(ctx context.Context, identifier resource.Identifier) (*FindScopeNavigationsResults, error) {
	return c.client.Get(ctx, identifier)
}

func (c *FindScopeNavigationsResultsClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*FindScopeNavigationsResultsList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *FindScopeNavigationsResultsClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*FindScopeNavigationsResultsList, error) {
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

func (c *FindScopeNavigationsResultsClient) Create(ctx context.Context, obj *FindScopeNavigationsResults, opts resource.CreateOptions) (*FindScopeNavigationsResults, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = FindScopeNavigationsResultsKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *FindScopeNavigationsResultsClient) Update(ctx context.Context, obj *FindScopeNavigationsResults, opts resource.UpdateOptions) (*FindScopeNavigationsResults, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *FindScopeNavigationsResultsClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*FindScopeNavigationsResults, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *FindScopeNavigationsResultsClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

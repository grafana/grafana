package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type FindScopeDashboardBindingsResultsClient struct {
	client *resource.TypedClient[*FindScopeDashboardBindingsResults, *FindScopeDashboardBindingsResultsList]
}

func NewFindScopeDashboardBindingsResultsClient(client resource.Client) *FindScopeDashboardBindingsResultsClient {
	return &FindScopeDashboardBindingsResultsClient{
		client: resource.NewTypedClient[*FindScopeDashboardBindingsResults, *FindScopeDashboardBindingsResultsList](client, FindScopeDashboardBindingsResultsKind()),
	}
}

func NewFindScopeDashboardBindingsResultsClientFromGenerator(generator resource.ClientGenerator) (*FindScopeDashboardBindingsResultsClient, error) {
	c, err := generator.ClientFor(FindScopeDashboardBindingsResultsKind())
	if err != nil {
		return nil, err
	}
	return NewFindScopeDashboardBindingsResultsClient(c), nil
}

func (c *FindScopeDashboardBindingsResultsClient) Get(ctx context.Context, identifier resource.Identifier) (*FindScopeDashboardBindingsResults, error) {
	return c.client.Get(ctx, identifier)
}

func (c *FindScopeDashboardBindingsResultsClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*FindScopeDashboardBindingsResultsList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *FindScopeDashboardBindingsResultsClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*FindScopeDashboardBindingsResultsList, error) {
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

func (c *FindScopeDashboardBindingsResultsClient) Create(ctx context.Context, obj *FindScopeDashboardBindingsResults, opts resource.CreateOptions) (*FindScopeDashboardBindingsResults, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = FindScopeDashboardBindingsResultsKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *FindScopeDashboardBindingsResultsClient) Update(ctx context.Context, obj *FindScopeDashboardBindingsResults, opts resource.UpdateOptions) (*FindScopeDashboardBindingsResults, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *FindScopeDashboardBindingsResultsClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*FindScopeDashboardBindingsResults, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *FindScopeDashboardBindingsResultsClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

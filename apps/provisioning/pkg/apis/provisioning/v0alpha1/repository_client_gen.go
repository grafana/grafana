package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type RepositoryClient struct {
	client *resource.TypedClient[*Repository, *RepositoryList]
}

func NewRepositoryClient(client resource.Client) *RepositoryClient {
	return &RepositoryClient{
		client: resource.NewTypedClient[*Repository, *RepositoryList](client, RepositoryKind()),
	}
}

func NewRepositoryClientFromGenerator(generator resource.ClientGenerator) (*RepositoryClient, error) {
	c, err := generator.ClientFor(RepositoryKind())
	if err != nil {
		return nil, err
	}
	return NewRepositoryClient(c), nil
}

func (c *RepositoryClient) Get(ctx context.Context, identifier resource.Identifier) (*Repository, error) {
	return c.client.Get(ctx, identifier)
}

func (c *RepositoryClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*RepositoryList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *RepositoryClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*RepositoryList, error) {
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

func (c *RepositoryClient) Create(ctx context.Context, obj *Repository, opts resource.CreateOptions) (*Repository, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = RepositoryKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *RepositoryClient) Update(ctx context.Context, obj *Repository, opts resource.UpdateOptions) (*Repository, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *RepositoryClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Repository, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *RepositoryClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

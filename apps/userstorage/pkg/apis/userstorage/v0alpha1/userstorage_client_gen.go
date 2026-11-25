package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type UserStorageClient struct {
	client *resource.TypedClient[*UserStorage, *UserStorageList]
}

func NewUserStorageClient(client resource.Client) *UserStorageClient {
	return &UserStorageClient{
		client: resource.NewTypedClient[*UserStorage, *UserStorageList](client, UserStorageKind()),
	}
}

func NewUserStorageClientFromGenerator(generator resource.ClientGenerator) (*UserStorageClient, error) {
	c, err := generator.ClientFor(UserStorageKind())
	if err != nil {
		return nil, err
	}
	return NewUserStorageClient(c), nil
}

func (c *UserStorageClient) Get(ctx context.Context, identifier resource.Identifier) (*UserStorage, error) {
	return c.client.Get(ctx, identifier)
}

func (c *UserStorageClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*UserStorageList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *UserStorageClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*UserStorageList, error) {
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

func (c *UserStorageClient) Create(ctx context.Context, obj *UserStorage, opts resource.CreateOptions) (*UserStorage, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = UserStorageKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *UserStorageClient) Update(ctx context.Context, obj *UserStorage, opts resource.UpdateOptions) (*UserStorage, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *UserStorageClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*UserStorage, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *UserStorageClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

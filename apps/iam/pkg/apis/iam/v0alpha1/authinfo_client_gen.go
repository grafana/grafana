package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type AuthInfoClient struct {
	client *resource.TypedClient[*AuthInfo, *AuthInfoList]
}

func NewAuthInfoClient(client resource.Client) *AuthInfoClient {
	return &AuthInfoClient{
		client: resource.NewTypedClient[*AuthInfo, *AuthInfoList](client, AuthInfoKind()),
	}
}

func NewAuthInfoClientFromGenerator(generator resource.ClientGenerator) (*AuthInfoClient, error) {
	c, err := generator.ClientFor(AuthInfoKind())
	if err != nil {
		return nil, err
	}
	return NewAuthInfoClient(c), nil
}

func (c *AuthInfoClient) Get(ctx context.Context, identifier resource.Identifier) (*AuthInfo, error) {
	return c.client.Get(ctx, identifier)
}

func (c *AuthInfoClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*AuthInfoList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *AuthInfoClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*AuthInfoList, error) {
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

func (c *AuthInfoClient) Create(ctx context.Context, obj *AuthInfo, opts resource.CreateOptions) (*AuthInfo, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = AuthInfoKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *AuthInfoClient) Update(ctx context.Context, obj *AuthInfo, opts resource.UpdateOptions) (*AuthInfo, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *AuthInfoClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*AuthInfo, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *AuthInfoClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

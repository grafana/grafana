package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type UserThemeClient struct {
	client *resource.TypedClient[*UserTheme, *UserThemeList]
}

func NewUserThemeClient(client resource.Client) *UserThemeClient {
	return &UserThemeClient{
		client: resource.NewTypedClient[*UserTheme, *UserThemeList](client, UserThemeKind()),
	}
}

func NewUserThemeClientFromGenerator(generator resource.ClientGenerator) (*UserThemeClient, error) {
	c, err := generator.ClientFor(UserThemeKind())
	if err != nil {
		return nil, err
	}
	return NewUserThemeClient(c), nil
}

func (c *UserThemeClient) Get(ctx context.Context, identifier resource.Identifier) (*UserTheme, error) {
	return c.client.Get(ctx, identifier)
}

func (c *UserThemeClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*UserThemeList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *UserThemeClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*UserThemeList, error) {
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

func (c *UserThemeClient) Create(ctx context.Context, obj *UserTheme, opts resource.CreateOptions) (*UserTheme, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = UserThemeKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *UserThemeClient) Update(ctx context.Context, obj *UserTheme, opts resource.UpdateOptions) (*UserTheme, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *UserThemeClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*UserTheme, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *UserThemeClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

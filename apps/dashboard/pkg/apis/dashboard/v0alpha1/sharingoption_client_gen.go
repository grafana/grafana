package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type SharingOptionClient struct {
	client *resource.TypedClient[*SharingOption, *SharingOptionList]
}

func NewSharingOptionClient(client resource.Client) *SharingOptionClient {
	return &SharingOptionClient{
		client: resource.NewTypedClient[*SharingOption, *SharingOptionList](client, SharingOptionKind()),
	}
}

func NewSharingOptionClientFromGenerator(generator resource.ClientGenerator) (*SharingOptionClient, error) {
	c, err := generator.ClientFor(SharingOptionKind())
	if err != nil {
		return nil, err
	}
	return NewSharingOptionClient(c), nil
}

func (c *SharingOptionClient) Get(ctx context.Context, identifier resource.Identifier) (*SharingOption, error) {
	return c.client.Get(ctx, identifier)
}

func (c *SharingOptionClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*SharingOptionList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *SharingOptionClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*SharingOptionList, error) {
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

func (c *SharingOptionClient) Create(ctx context.Context, obj *SharingOption, opts resource.CreateOptions) (*SharingOption, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = SharingOptionKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *SharingOptionClient) Update(ctx context.Context, obj *SharingOption, opts resource.UpdateOptions) (*SharingOption, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *SharingOptionClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*SharingOption, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *SharingOptionClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

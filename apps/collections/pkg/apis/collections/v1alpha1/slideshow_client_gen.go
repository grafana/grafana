package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type SlideshowClient struct {
	client *resource.TypedClient[*Slideshow, *SlideshowList]
}

func NewSlideshowClient(client resource.Client) *SlideshowClient {
	return &SlideshowClient{
		client: resource.NewTypedClient[*Slideshow, *SlideshowList](client, SlideshowKind()),
	}
}

func NewSlideshowClientFromGenerator(generator resource.ClientGenerator) (*SlideshowClient, error) {
	c, err := generator.ClientFor(SlideshowKind())
	if err != nil {
		return nil, err
	}
	return NewSlideshowClient(c), nil
}

func (c *SlideshowClient) Get(ctx context.Context, identifier resource.Identifier) (*Slideshow, error) {
	return c.client.Get(ctx, identifier)
}

func (c *SlideshowClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*SlideshowList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *SlideshowClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*SlideshowList, error) {
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

func (c *SlideshowClient) Create(ctx context.Context, obj *Slideshow, opts resource.CreateOptions) (*Slideshow, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = SlideshowKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *SlideshowClient) Update(ctx context.Context, obj *Slideshow, opts resource.UpdateOptions) (*Slideshow, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *SlideshowClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Slideshow, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *SlideshowClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

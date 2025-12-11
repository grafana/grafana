package v1beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ChannelClient struct {
	client *resource.TypedClient[*Channel, *ChannelList]
}

func NewChannelClient(client resource.Client) *ChannelClient {
	return &ChannelClient{
		client: resource.NewTypedClient[*Channel, *ChannelList](client, ChannelKind()),
	}
}

func NewChannelClientFromGenerator(generator resource.ClientGenerator) (*ChannelClient, error) {
	c, err := generator.ClientFor(ChannelKind())
	if err != nil {
		return nil, err
	}
	return NewChannelClient(c), nil
}

func (c *ChannelClient) Get(ctx context.Context, identifier resource.Identifier) (*Channel, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ChannelClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ChannelList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ChannelClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ChannelList, error) {
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

func (c *ChannelClient) Create(ctx context.Context, obj *Channel, opts resource.CreateOptions) (*Channel, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ChannelKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ChannelClient) Update(ctx context.Context, obj *Channel, opts resource.UpdateOptions) (*Channel, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ChannelClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Channel, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ChannelClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

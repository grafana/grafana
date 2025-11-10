package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ReceiverClient struct {
	client *resource.TypedClient[*Receiver, *ReceiverList]
}

func NewReceiverClient(client resource.Client) *ReceiverClient {
	return &ReceiverClient{
		client: resource.NewTypedClient[*Receiver, *ReceiverList](client, ReceiverKind()),
	}
}

func NewReceiverClientFromGenerator(generator resource.ClientGenerator) (*ReceiverClient, error) {
	c, err := generator.ClientFor(ReceiverKind())
	if err != nil {
		return nil, err
	}
	return NewReceiverClient(c), nil
}

func (c *ReceiverClient) Get(ctx context.Context, identifier resource.Identifier) (*Receiver, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ReceiverClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ReceiverList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ReceiverClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ReceiverList, error) {
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

func (c *ReceiverClient) Create(ctx context.Context, obj *Receiver, opts resource.CreateOptions) (*Receiver, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ReceiverKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ReceiverClient) Update(ctx context.Context, obj *Receiver, opts resource.UpdateOptions) (*Receiver, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ReceiverClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Receiver, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ReceiverClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

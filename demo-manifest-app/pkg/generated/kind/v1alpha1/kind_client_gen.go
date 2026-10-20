package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type KindClient struct {
	client *resource.TypedClient[*Kind, *KindList]
}

func NewKindClient(client resource.Client) *KindClient {
	return &KindClient{
		client: resource.NewTypedClient[*Kind, *KindList](client, KindKind()),
	}
}

func NewKindClientFromGenerator(generator resource.ClientGenerator) (*KindClient, error) {
	c, err := generator.ClientFor(KindKind())
	if err != nil {
		return nil, err
	}
	return NewKindClient(c), nil
}

func (c *KindClient) Get(ctx context.Context, identifier resource.Identifier) (*Kind, error) {
	return c.client.Get(ctx, identifier)
}

func (c *KindClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*KindList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *KindClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*KindList, error) {
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

func (c *KindClient) Create(ctx context.Context, obj *Kind, opts resource.CreateOptions) (*Kind, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = KindKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *KindClient) Update(ctx context.Context, obj *Kind, opts resource.UpdateOptions) (*Kind, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *KindClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Kind, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *KindClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

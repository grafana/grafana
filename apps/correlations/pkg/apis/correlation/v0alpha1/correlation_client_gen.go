package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type CorrelationClient struct {
	client *resource.TypedClient[*Correlation, *CorrelationList]
}

func NewCorrelationClient(client resource.Client) *CorrelationClient {
	return &CorrelationClient{
		client: resource.NewTypedClient[*Correlation, *CorrelationList](client, CorrelationKind()),
	}
}

func NewCorrelationClientFromGenerator(generator resource.ClientGenerator) (*CorrelationClient, error) {
	c, err := generator.ClientFor(CorrelationKind())
	if err != nil {
		return nil, err
	}
	return NewCorrelationClient(c), nil
}

func (c *CorrelationClient) Get(ctx context.Context, identifier resource.Identifier) (*Correlation, error) {
	return c.client.Get(ctx, identifier)
}

func (c *CorrelationClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*CorrelationList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *CorrelationClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*CorrelationList, error) {
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

func (c *CorrelationClient) Create(ctx context.Context, obj *Correlation, opts resource.CreateOptions) (*Correlation, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = CorrelationKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *CorrelationClient) Update(ctx context.Context, obj *Correlation, opts resource.UpdateOptions) (*Correlation, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *CorrelationClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Correlation, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *CorrelationClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type InhibitionRuleClient struct {
	client *resource.TypedClient[*InhibitionRule, *InhibitionRuleList]
}

func NewInhibitionRuleClient(client resource.Client) *InhibitionRuleClient {
	return &InhibitionRuleClient{
		client: resource.NewTypedClient[*InhibitionRule, *InhibitionRuleList](client, InhibitionRuleKind()),
	}
}

func NewInhibitionRuleClientFromGenerator(generator resource.ClientGenerator) (*InhibitionRuleClient, error) {
	c, err := generator.ClientFor(InhibitionRuleKind())
	if err != nil {
		return nil, err
	}
	return NewInhibitionRuleClient(c), nil
}

func (c *InhibitionRuleClient) Get(ctx context.Context, identifier resource.Identifier) (*InhibitionRule, error) {
	return c.client.Get(ctx, identifier)
}

func (c *InhibitionRuleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*InhibitionRuleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *InhibitionRuleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*InhibitionRuleList, error) {
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

func (c *InhibitionRuleClient) Create(ctx context.Context, obj *InhibitionRule, opts resource.CreateOptions) (*InhibitionRule, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = InhibitionRuleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *InhibitionRuleClient) Update(ctx context.Context, obj *InhibitionRule, opts resource.UpdateOptions) (*InhibitionRule, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *InhibitionRuleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*InhibitionRule, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *InhibitionRuleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

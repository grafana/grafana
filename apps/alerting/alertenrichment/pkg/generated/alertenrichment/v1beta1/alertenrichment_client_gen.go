package v1beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type AlertEnrichmentClient struct {
	client *resource.TypedClient[*AlertEnrichment, *AlertEnrichmentList]
}

func NewAlertEnrichmentClient(client resource.Client) *AlertEnrichmentClient {
	return &AlertEnrichmentClient{
		client: resource.NewTypedClient[*AlertEnrichment, *AlertEnrichmentList](client, AlertEnrichmentKind()),
	}
}

func NewAlertEnrichmentClientFromGenerator(generator resource.ClientGenerator) (*AlertEnrichmentClient, error) {
	c, err := generator.ClientFor(AlertEnrichmentKind())
	if err != nil {
		return nil, err
	}
	return NewAlertEnrichmentClient(c), nil
}

func (c *AlertEnrichmentClient) Get(ctx context.Context, identifier resource.Identifier) (*AlertEnrichment, error) {
	return c.client.Get(ctx, identifier)
}

func (c *AlertEnrichmentClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*AlertEnrichmentList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *AlertEnrichmentClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*AlertEnrichmentList, error) {
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

func (c *AlertEnrichmentClient) Create(ctx context.Context, obj *AlertEnrichment, opts resource.CreateOptions) (*AlertEnrichment, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = AlertEnrichmentKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *AlertEnrichmentClient) Update(ctx context.Context, obj *AlertEnrichment, opts resource.UpdateOptions) (*AlertEnrichment, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *AlertEnrichmentClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*AlertEnrichment, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *AlertEnrichmentClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

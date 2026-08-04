package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type AlertRuleQualityPolicyClient struct {
	client *resource.TypedClient[*AlertRuleQualityPolicy, *AlertRuleQualityPolicyList]
}

func NewAlertRuleQualityPolicyClient(client resource.Client) *AlertRuleQualityPolicyClient {
	return &AlertRuleQualityPolicyClient{
		client: resource.NewTypedClient[*AlertRuleQualityPolicy, *AlertRuleQualityPolicyList](client, AlertRuleQualityPolicyKind()),
	}
}

func NewAlertRuleQualityPolicyClientFromGenerator(generator resource.ClientGenerator) (*AlertRuleQualityPolicyClient, error) {
	c, err := generator.ClientFor(AlertRuleQualityPolicyKind())
	if err != nil {
		return nil, err
	}
	return NewAlertRuleQualityPolicyClient(c), nil
}

func (c *AlertRuleQualityPolicyClient) Get(ctx context.Context, identifier resource.Identifier) (*AlertRuleQualityPolicy, error) {
	return c.client.Get(ctx, identifier)
}

func (c *AlertRuleQualityPolicyClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*AlertRuleQualityPolicyList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *AlertRuleQualityPolicyClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*AlertRuleQualityPolicyList, error) {
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

func (c *AlertRuleQualityPolicyClient) Create(ctx context.Context, obj *AlertRuleQualityPolicy, opts resource.CreateOptions) (*AlertRuleQualityPolicy, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = AlertRuleQualityPolicyKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *AlertRuleQualityPolicyClient) Update(ctx context.Context, obj *AlertRuleQualityPolicy, opts resource.UpdateOptions) (*AlertRuleQualityPolicy, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *AlertRuleQualityPolicyClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*AlertRuleQualityPolicy, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *AlertRuleQualityPolicyClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

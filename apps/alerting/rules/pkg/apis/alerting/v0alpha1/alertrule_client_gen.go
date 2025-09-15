package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type AlertRuleClient struct {
	client *resource.TypedClient[*AlertRule, *AlertRuleList]
}

func NewAlertRuleClient(client resource.Client) *AlertRuleClient {
	return &AlertRuleClient{
		client: resource.NewTypedClient[*AlertRule, *AlertRuleList](client, AlertRuleKind()),
	}
}

func NewAlertRuleClientFromGenerator(generator resource.ClientGenerator) (*AlertRuleClient, error) {
	c, err := generator.ClientFor(AlertRuleKind())
	if err != nil {
		return nil, err
	}
	return NewAlertRuleClient(c), nil
}

func (c *AlertRuleClient) Get(ctx context.Context, identifier resource.Identifier) (*AlertRule, error) {
	return c.client.Get(ctx, identifier)
}

func (c *AlertRuleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*AlertRuleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *AlertRuleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*AlertRuleList, error) {
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

func (c *AlertRuleClient) Create(ctx context.Context, obj *AlertRule, opts resource.CreateOptions) (*AlertRule, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = AlertRuleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *AlertRuleClient) Update(ctx context.Context, obj *AlertRule, opts resource.UpdateOptions) (*AlertRule, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *AlertRuleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*AlertRule, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *AlertRuleClient) UpdateStatus(ctx context.Context, newStatus AlertRuleStatus, opts resource.UpdateOptions) (*AlertRule, error) {
	return c.client.Update(ctx, &AlertRule{
		TypeMeta: metav1.TypeMeta{
			Kind:       AlertRuleKind().Kind(),
			APIVersion: GroupVersion.Identifier(),
		},
		ObjectMeta: metav1.ObjectMeta{
			ResourceVersion: opts.ResourceVersion,
		},
		Status: newStatus,
	}, resource.UpdateOptions{
		Subresource:     "status",
		ResourceVersion: opts.ResourceVersion,
	})
}

func (c *AlertRuleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

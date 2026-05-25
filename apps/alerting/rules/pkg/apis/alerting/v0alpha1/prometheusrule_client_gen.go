package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PrometheusRuleClient struct {
	client *resource.TypedClient[*PrometheusRule, *PrometheusRuleList]
}

func NewPrometheusRuleClient(client resource.Client) *PrometheusRuleClient {
	return &PrometheusRuleClient{
		client: resource.NewTypedClient[*PrometheusRule, *PrometheusRuleList](client, PrometheusRuleKind()),
	}
}

func NewPrometheusRuleClientFromGenerator(generator resource.ClientGenerator) (*PrometheusRuleClient, error) {
	c, err := generator.ClientFor(PrometheusRuleKind())
	if err != nil {
		return nil, err
	}
	return NewPrometheusRuleClient(c), nil
}

func (c *PrometheusRuleClient) Get(ctx context.Context, identifier resource.Identifier) (*PrometheusRule, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PrometheusRuleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PrometheusRuleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PrometheusRuleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PrometheusRuleList, error) {
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

func (c *PrometheusRuleClient) Create(ctx context.Context, obj *PrometheusRule, opts resource.CreateOptions) (*PrometheusRule, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PrometheusRuleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PrometheusRuleClient) Update(ctx context.Context, obj *PrometheusRule, opts resource.UpdateOptions) (*PrometheusRule, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PrometheusRuleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*PrometheusRule, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PrometheusRuleClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus PrometheusRuleStatus, opts resource.UpdateOptions) (*PrometheusRule, error) {
	return c.client.Update(ctx, &PrometheusRule{
		TypeMeta: metav1.TypeMeta{
			Kind:       PrometheusRuleKind().Kind(),
			APIVersion: GroupVersion.Identifier(),
		},
		ObjectMeta: metav1.ObjectMeta{
			ResourceVersion: opts.ResourceVersion,
			Namespace:       identifier.Namespace,
			Name:            identifier.Name,
		},
		Status: newStatus,
	}, resource.UpdateOptions{
		Subresource:     "status",
		ResourceVersion: opts.ResourceVersion,
	})
}

func (c *PrometheusRuleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PrometheusRuleGroupClient struct {
	client *resource.TypedClient[*PrometheusRuleGroup, *PrometheusRuleGroupList]
}

func NewPrometheusRuleGroupClient(client resource.Client) *PrometheusRuleGroupClient {
	return &PrometheusRuleGroupClient{
		client: resource.NewTypedClient[*PrometheusRuleGroup, *PrometheusRuleGroupList](client, PrometheusRuleGroupKind()),
	}
}

func NewPrometheusRuleGroupClientFromGenerator(generator resource.ClientGenerator) (*PrometheusRuleGroupClient, error) {
	c, err := generator.ClientFor(PrometheusRuleGroupKind())
	if err != nil {
		return nil, err
	}
	return NewPrometheusRuleGroupClient(c), nil
}

func (c *PrometheusRuleGroupClient) Get(ctx context.Context, identifier resource.Identifier) (*PrometheusRuleGroup, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PrometheusRuleGroupClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PrometheusRuleGroupList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PrometheusRuleGroupClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PrometheusRuleGroupList, error) {
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

func (c *PrometheusRuleGroupClient) Create(ctx context.Context, obj *PrometheusRuleGroup, opts resource.CreateOptions) (*PrometheusRuleGroup, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PrometheusRuleGroupKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PrometheusRuleGroupClient) Update(ctx context.Context, obj *PrometheusRuleGroup, opts resource.UpdateOptions) (*PrometheusRuleGroup, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PrometheusRuleGroupClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*PrometheusRuleGroup, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PrometheusRuleGroupClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus PrometheusRuleGroupStatus, opts resource.UpdateOptions) (*PrometheusRuleGroup, error) {
	return c.client.Update(ctx, &PrometheusRuleGroup{
		TypeMeta: metav1.TypeMeta{
			Kind:       PrometheusRuleGroupKind().Kind(),
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

func (c *PrometheusRuleGroupClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

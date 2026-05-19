package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PrometheusRuleFileClient struct {
	client *resource.TypedClient[*PrometheusRuleFile, *PrometheusRuleFileList]
}

func NewPrometheusRuleFileClient(client resource.Client) *PrometheusRuleFileClient {
	return &PrometheusRuleFileClient{
		client: resource.NewTypedClient[*PrometheusRuleFile, *PrometheusRuleFileList](client, PrometheusRuleFileKind()),
	}
}

func NewPrometheusRuleFileClientFromGenerator(generator resource.ClientGenerator) (*PrometheusRuleFileClient, error) {
	c, err := generator.ClientFor(PrometheusRuleFileKind())
	if err != nil {
		return nil, err
	}
	return NewPrometheusRuleFileClient(c), nil
}

func (c *PrometheusRuleFileClient) Get(ctx context.Context, identifier resource.Identifier) (*PrometheusRuleFile, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PrometheusRuleFileClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PrometheusRuleFileList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PrometheusRuleFileClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PrometheusRuleFileList, error) {
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

func (c *PrometheusRuleFileClient) Create(ctx context.Context, obj *PrometheusRuleFile, opts resource.CreateOptions) (*PrometheusRuleFile, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PrometheusRuleFileKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PrometheusRuleFileClient) Update(ctx context.Context, obj *PrometheusRuleFile, opts resource.UpdateOptions) (*PrometheusRuleFile, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PrometheusRuleFileClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*PrometheusRuleFile, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PrometheusRuleFileClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus PrometheusRuleFileStatus, opts resource.UpdateOptions) (*PrometheusRuleFile, error) {
	return c.client.Update(ctx, &PrometheusRuleFile{
		TypeMeta: metav1.TypeMeta{
			Kind:       PrometheusRuleFileKind().Kind(),
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

func (c *PrometheusRuleFileClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

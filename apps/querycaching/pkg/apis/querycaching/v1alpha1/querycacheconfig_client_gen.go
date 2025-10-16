package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type QueryCacheConfigClient struct {
	client *resource.TypedClient[*QueryCacheConfig, *QueryCacheConfigList]
}

func NewQueryCacheConfigClient(client resource.Client) *QueryCacheConfigClient {
	return &QueryCacheConfigClient{
		client: resource.NewTypedClient[*QueryCacheConfig, *QueryCacheConfigList](client, QueryCacheConfigKind()),
	}
}

func NewQueryCacheConfigClientFromGenerator(generator resource.ClientGenerator) (*QueryCacheConfigClient, error) {
	c, err := generator.ClientFor(QueryCacheConfigKind())
	if err != nil {
		return nil, err
	}
	return NewQueryCacheConfigClient(c), nil
}

func (c *QueryCacheConfigClient) Get(ctx context.Context, identifier resource.Identifier) (*QueryCacheConfig, error) {
	return c.client.Get(ctx, identifier)
}

func (c *QueryCacheConfigClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*QueryCacheConfigList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *QueryCacheConfigClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*QueryCacheConfigList, error) {
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

func (c *QueryCacheConfigClient) Create(ctx context.Context, obj *QueryCacheConfig, opts resource.CreateOptions) (*QueryCacheConfig, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = QueryCacheConfigKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *QueryCacheConfigClient) Update(ctx context.Context, obj *QueryCacheConfig, opts resource.UpdateOptions) (*QueryCacheConfig, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *QueryCacheConfigClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*QueryCacheConfig, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *QueryCacheConfigClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus QueryCacheConfigStatus, opts resource.UpdateOptions) (*QueryCacheConfig, error) {
	return c.client.Update(ctx, &QueryCacheConfig{
		TypeMeta: metav1.TypeMeta{
			Kind:       QueryCacheConfigKind().Kind(),
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

func (c *QueryCacheConfigClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

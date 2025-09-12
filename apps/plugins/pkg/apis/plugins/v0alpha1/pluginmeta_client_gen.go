package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PluginMetaClient struct {
	client *resource.TypedClient[*PluginMeta, *PluginMetaList]
}

func NewPluginMetaClient(client resource.Client) *PluginMetaClient {
	return &PluginMetaClient{
		client: resource.NewTypedClient[*PluginMeta, *PluginMetaList](client, PluginMetaKind()),
	}
}

func NewPluginMetaClientFromGenerator(generator resource.ClientGenerator) (*PluginMetaClient, error) {
	c, err := generator.ClientFor(PluginMetaKind())
	if err != nil {
		return nil, err
	}
	return NewPluginMetaClient(c), nil
}

func (c *PluginMetaClient) Get(ctx context.Context, identifier resource.Identifier) (*PluginMeta, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PluginMetaClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PluginMetaList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PluginMetaClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PluginMetaList, error) {
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

func (c *PluginMetaClient) Create(ctx context.Context, obj *PluginMeta, opts resource.CreateOptions) (*PluginMeta, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PluginMetaKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PluginMetaClient) Update(ctx context.Context, obj *PluginMeta, opts resource.UpdateOptions) (*PluginMeta, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PluginMetaClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*PluginMeta, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PluginMetaClient) UpdateStatus(ctx context.Context, newStatus PluginMetaStatus, opts resource.UpdateOptions) (*PluginMeta, error) {
	return c.client.Update(ctx, &PluginMeta{
		TypeMeta: metav1.TypeMeta{
			Kind:       PluginMetaKind().Kind(),
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

func (c *PluginMetaClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

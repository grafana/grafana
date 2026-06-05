package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type AdminConfigClient struct {
	client *resource.TypedClient[*AdminConfig, *AdminConfigList]
}

func NewAdminConfigClient(client resource.Client) *AdminConfigClient {
	return &AdminConfigClient{
		client: resource.NewTypedClient[*AdminConfig, *AdminConfigList](client, AdminConfigKind()),
	}
}

func NewAdminConfigClientFromGenerator(generator resource.ClientGenerator) (*AdminConfigClient, error) {
	c, err := generator.ClientFor(AdminConfigKind())
	if err != nil {
		return nil, err
	}
	return NewAdminConfigClient(c), nil
}

func (c *AdminConfigClient) Get(ctx context.Context, identifier resource.Identifier) (*AdminConfig, error) {
	return c.client.Get(ctx, identifier)
}

func (c *AdminConfigClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*AdminConfigList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *AdminConfigClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*AdminConfigList, error) {
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

func (c *AdminConfigClient) Create(ctx context.Context, obj *AdminConfig, opts resource.CreateOptions) (*AdminConfig, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = AdminConfigKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *AdminConfigClient) Update(ctx context.Context, obj *AdminConfig, opts resource.UpdateOptions) (*AdminConfig, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *AdminConfigClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*AdminConfig, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *AdminConfigClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus AdminConfigStatus, opts resource.UpdateOptions) (*AdminConfig, error) {
	return c.client.Update(ctx, &AdminConfig{
		TypeMeta: metav1.TypeMeta{
			Kind:       AdminConfigKind().Kind(),
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

func (c *AdminConfigClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

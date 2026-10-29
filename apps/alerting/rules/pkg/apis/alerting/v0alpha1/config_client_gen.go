package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ConfigClient struct {
	client *resource.TypedClient[*Config, *ConfigList]
}

func NewConfigClient(client resource.Client) *ConfigClient {
	return &ConfigClient{
		client: resource.NewTypedClient[*Config, *ConfigList](client, ConfigKind()),
	}
}

func NewConfigClientFromGenerator(generator resource.ClientGenerator) (*ConfigClient, error) {
	c, err := generator.ClientFor(ConfigKind())
	if err != nil {
		return nil, err
	}
	return NewConfigClient(c), nil
}

func (c *ConfigClient) Get(ctx context.Context, identifier resource.Identifier) (*Config, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ConfigClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ConfigList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ConfigClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ConfigList, error) {
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

func (c *ConfigClient) Create(ctx context.Context, obj *Config, opts resource.CreateOptions) (*Config, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ConfigKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ConfigClient) Update(ctx context.Context, obj *Config, opts resource.UpdateOptions) (*Config, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ConfigClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Config, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ConfigClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus ConfigStatus, opts resource.UpdateOptions) (*Config, error) {
	return c.client.Update(ctx, &Config{
		TypeMeta: metav1.TypeMeta{
			Kind:       ConfigKind().Kind(),
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

func (c *ConfigClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

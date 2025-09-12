package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PluginInstallClient struct {
	client *resource.TypedClient[*PluginInstall, *PluginInstallList]
}

func NewPluginInstallClient(client resource.Client) *PluginInstallClient {
	return &PluginInstallClient{
		client: resource.NewTypedClient[*PluginInstall, *PluginInstallList](client, PluginInstallKind()),
	}
}

func NewPluginInstallClientFromGenerator(generator resource.ClientGenerator) (*PluginInstallClient, error) {
	c, err := generator.ClientFor(PluginInstallKind())
	if err != nil {
		return nil, err
	}
	return NewPluginInstallClient(c), nil
}

func (c *PluginInstallClient) Get(ctx context.Context, identifier resource.Identifier) (*PluginInstall, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PluginInstallClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PluginInstallList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PluginInstallClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PluginInstallList, error) {
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

func (c *PluginInstallClient) Create(ctx context.Context, obj *PluginInstall, opts resource.CreateOptions) (*PluginInstall, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PluginInstallKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PluginInstallClient) Update(ctx context.Context, obj *PluginInstall, opts resource.UpdateOptions) (*PluginInstall, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PluginInstallClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*PluginInstall, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PluginInstallClient) UpdateStatus(ctx context.Context, newStatus PluginInstallStatus, opts resource.UpdateOptions) (*PluginInstall, error) {
	return c.client.Update(ctx, &PluginInstall{
		TypeMeta: metav1.TypeMeta{
			Kind:       PluginInstallKind().Kind(),
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

func (c *PluginInstallClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ScopeDashboardBindingClient struct {
	client *resource.TypedClient[*ScopeDashboardBinding, *ScopeDashboardBindingList]
}

func NewScopeDashboardBindingClient(client resource.Client) *ScopeDashboardBindingClient {
	return &ScopeDashboardBindingClient{
		client: resource.NewTypedClient[*ScopeDashboardBinding, *ScopeDashboardBindingList](client, ScopeDashboardBindingKind()),
	}
}

func NewScopeDashboardBindingClientFromGenerator(generator resource.ClientGenerator) (*ScopeDashboardBindingClient, error) {
	c, err := generator.ClientFor(ScopeDashboardBindingKind())
	if err != nil {
		return nil, err
	}
	return NewScopeDashboardBindingClient(c), nil
}

func (c *ScopeDashboardBindingClient) Get(ctx context.Context, identifier resource.Identifier) (*ScopeDashboardBinding, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ScopeDashboardBindingClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ScopeDashboardBindingList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ScopeDashboardBindingClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ScopeDashboardBindingList, error) {
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

func (c *ScopeDashboardBindingClient) Create(ctx context.Context, obj *ScopeDashboardBinding, opts resource.CreateOptions) (*ScopeDashboardBinding, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ScopeDashboardBindingKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ScopeDashboardBindingClient) Update(ctx context.Context, obj *ScopeDashboardBinding, opts resource.UpdateOptions) (*ScopeDashboardBinding, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ScopeDashboardBindingClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ScopeDashboardBinding, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ScopeDashboardBindingClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus ScopeDashboardBindingStatus, opts resource.UpdateOptions) (*ScopeDashboardBinding, error) {
	return c.client.Update(ctx, &ScopeDashboardBinding{
		TypeMeta: metav1.TypeMeta{
			Kind:       ScopeDashboardBindingKind().Kind(),
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

func (c *ScopeDashboardBindingClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

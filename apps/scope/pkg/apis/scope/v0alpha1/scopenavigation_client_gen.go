package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ScopeNavigationClient struct {
	client *resource.TypedClient[*ScopeNavigation, *ScopeNavigationList]
}

func NewScopeNavigationClient(client resource.Client) *ScopeNavigationClient {
	return &ScopeNavigationClient{
		client: resource.NewTypedClient[*ScopeNavigation, *ScopeNavigationList](client, ScopeNavigationKind()),
	}
}

func NewScopeNavigationClientFromGenerator(generator resource.ClientGenerator) (*ScopeNavigationClient, error) {
	c, err := generator.ClientFor(ScopeNavigationKind())
	if err != nil {
		return nil, err
	}
	return NewScopeNavigationClient(c), nil
}

func (c *ScopeNavigationClient) Get(ctx context.Context, identifier resource.Identifier) (*ScopeNavigation, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ScopeNavigationClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ScopeNavigationList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ScopeNavigationClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ScopeNavigationList, error) {
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

func (c *ScopeNavigationClient) Create(ctx context.Context, obj *ScopeNavigation, opts resource.CreateOptions) (*ScopeNavigation, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ScopeNavigationKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ScopeNavigationClient) Update(ctx context.Context, obj *ScopeNavigation, opts resource.UpdateOptions) (*ScopeNavigation, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ScopeNavigationClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ScopeNavigation, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ScopeNavigationClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus ScopeNavigationStatus, opts resource.UpdateOptions) (*ScopeNavigation, error) {
	return c.client.Update(ctx, &ScopeNavigation{
		TypeMeta: metav1.TypeMeta{
			Kind:       ScopeNavigationKind().Kind(),
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

func (c *ScopeNavigationClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

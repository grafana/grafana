package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type GlobalRoleClient struct {
	client *resource.TypedClient[*GlobalRole, *GlobalRoleList]
}

func NewGlobalRoleClient(client resource.Client) *GlobalRoleClient {
	return &GlobalRoleClient{
		client: resource.NewTypedClient[*GlobalRole, *GlobalRoleList](client, GlobalRoleKind()),
	}
}

func NewGlobalRoleClientFromGenerator(generator resource.ClientGenerator) (*GlobalRoleClient, error) {
	c, err := generator.ClientFor(GlobalRoleKind())
	if err != nil {
		return nil, err
	}
	return NewGlobalRoleClient(c), nil
}

func (c *GlobalRoleClient) Get(ctx context.Context, identifier resource.Identifier) (*GlobalRole, error) {
	return c.client.Get(ctx, identifier)
}

func (c *GlobalRoleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*GlobalRoleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *GlobalRoleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*GlobalRoleList, error) {
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

func (c *GlobalRoleClient) Create(ctx context.Context, obj *GlobalRole, opts resource.CreateOptions) (*GlobalRole, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = GlobalRoleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *GlobalRoleClient) Update(ctx context.Context, obj *GlobalRole, opts resource.UpdateOptions) (*GlobalRole, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *GlobalRoleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*GlobalRole, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *GlobalRoleClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus GlobalRoleStatus, opts resource.UpdateOptions) (*GlobalRole, error) {
	return c.client.Update(ctx, &GlobalRole{
		TypeMeta: metav1.TypeMeta{
			Kind:       GlobalRoleKind().Kind(),
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

func (c *GlobalRoleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

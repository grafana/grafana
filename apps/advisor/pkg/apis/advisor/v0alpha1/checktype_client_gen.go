package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type CheckTypeClient struct {
	client *resource.TypedClient[*CheckType, *CheckTypeList]
}

func NewCheckTypeClient(client resource.Client) *CheckTypeClient {
	return &CheckTypeClient{
		client: resource.NewTypedClient[*CheckType, *CheckTypeList](client, CheckTypeKind()),
	}
}

func NewCheckTypeClientFromGenerator(generator resource.ClientGenerator) (*CheckTypeClient, error) {
	c, err := generator.ClientFor(CheckTypeKind())
	if err != nil {
		return nil, err
	}
	return NewCheckTypeClient(c), nil
}

func (c *CheckTypeClient) Get(ctx context.Context, identifier resource.Identifier) (*CheckType, error) {
	return c.client.Get(ctx, identifier)
}

func (c *CheckTypeClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*CheckTypeList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *CheckTypeClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*CheckTypeList, error) {
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

func (c *CheckTypeClient) Create(ctx context.Context, obj *CheckType, opts resource.CreateOptions) (*CheckType, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = CheckTypeKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *CheckTypeClient) Update(ctx context.Context, obj *CheckType, opts resource.UpdateOptions) (*CheckType, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *CheckTypeClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*CheckType, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *CheckTypeClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus CheckTypeStatus, opts resource.UpdateOptions) (*CheckType, error) {
	return c.client.Update(ctx, &CheckType{
		TypeMeta: metav1.TypeMeta{
			Kind:       CheckTypeKind().Kind(),
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

func (c *CheckTypeClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

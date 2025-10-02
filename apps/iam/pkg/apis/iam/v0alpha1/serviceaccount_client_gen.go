package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ServiceAccountClient struct {
	client *resource.TypedClient[*ServiceAccount, *ServiceAccountList]
}

func NewServiceAccountClient(client resource.Client) *ServiceAccountClient {
	return &ServiceAccountClient{
		client: resource.NewTypedClient[*ServiceAccount, *ServiceAccountList](client, ServiceAccountKind()),
	}
}

func NewServiceAccountClientFromGenerator(generator resource.ClientGenerator) (*ServiceAccountClient, error) {
	c, err := generator.ClientFor(ServiceAccountKind())
	if err != nil {
		return nil, err
	}
	return NewServiceAccountClient(c), nil
}

func (c *ServiceAccountClient) Get(ctx context.Context, identifier resource.Identifier) (*ServiceAccount, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ServiceAccountClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ServiceAccountList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ServiceAccountClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ServiceAccountList, error) {
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

func (c *ServiceAccountClient) Create(ctx context.Context, obj *ServiceAccount, opts resource.CreateOptions) (*ServiceAccount, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ServiceAccountKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ServiceAccountClient) Update(ctx context.Context, obj *ServiceAccount, opts resource.UpdateOptions) (*ServiceAccount, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ServiceAccountClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ServiceAccount, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ServiceAccountClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

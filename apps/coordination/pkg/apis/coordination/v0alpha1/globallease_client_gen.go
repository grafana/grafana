package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type GlobalLeaseClient struct {
	client *resource.TypedClient[*GlobalLease, *GlobalLeaseList]
}

func NewGlobalLeaseClient(client resource.Client) *GlobalLeaseClient {
	return &GlobalLeaseClient{
		client: resource.NewTypedClient[*GlobalLease, *GlobalLeaseList](client, GlobalLeaseKind()),
	}
}

func NewGlobalLeaseClientFromGenerator(generator resource.ClientGenerator) (*GlobalLeaseClient, error) {
	c, err := generator.ClientFor(GlobalLeaseKind())
	if err != nil {
		return nil, err
	}
	return NewGlobalLeaseClient(c), nil
}

func (c *GlobalLeaseClient) Get(ctx context.Context, identifier resource.Identifier) (*GlobalLease, error) {
	return c.client.Get(ctx, identifier)
}

func (c *GlobalLeaseClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*GlobalLeaseList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *GlobalLeaseClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*GlobalLeaseList, error) {
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

func (c *GlobalLeaseClient) Create(ctx context.Context, obj *GlobalLease, opts resource.CreateOptions) (*GlobalLease, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = GlobalLeaseKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *GlobalLeaseClient) Update(ctx context.Context, obj *GlobalLease, opts resource.UpdateOptions) (*GlobalLease, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *GlobalLeaseClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*GlobalLease, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *GlobalLeaseClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus GlobalLeaseStatus, opts resource.UpdateOptions) (*GlobalLease, error) {
	return c.client.Update(ctx, &GlobalLease{
		TypeMeta: metav1.TypeMeta{
			Kind:       GlobalLeaseKind().Kind(),
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

func (c *GlobalLeaseClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

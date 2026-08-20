package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type LeaseClient struct {
	client *resource.TypedClient[*Lease, *LeaseList]
}

func NewLeaseClient(client resource.Client) *LeaseClient {
	return &LeaseClient{
		client: resource.NewTypedClient[*Lease, *LeaseList](client, LeaseKind()),
	}
}

func NewLeaseClientFromGenerator(generator resource.ClientGenerator) (*LeaseClient, error) {
	c, err := generator.ClientFor(LeaseKind())
	if err != nil {
		return nil, err
	}
	return NewLeaseClient(c), nil
}

func (c *LeaseClient) Get(ctx context.Context, identifier resource.Identifier) (*Lease, error) {
	return c.client.Get(ctx, identifier)
}

func (c *LeaseClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*LeaseList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *LeaseClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*LeaseList, error) {
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

func (c *LeaseClient) Create(ctx context.Context, obj *Lease, opts resource.CreateOptions) (*Lease, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = LeaseKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *LeaseClient) Update(ctx context.Context, obj *Lease, opts resource.UpdateOptions) (*Lease, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *LeaseClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Lease, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *LeaseClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus LeaseStatus, opts resource.UpdateOptions) (*Lease, error) {
	return c.client.Update(ctx, &Lease{
		TypeMeta: metav1.TypeMeta{
			Kind:       LeaseKind().Kind(),
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

func (c *LeaseClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

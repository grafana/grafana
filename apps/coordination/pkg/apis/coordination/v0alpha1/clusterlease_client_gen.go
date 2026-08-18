package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ClusterLeaseClient struct {
	client *resource.TypedClient[*ClusterLease, *ClusterLeaseList]
}

func NewClusterLeaseClient(client resource.Client) *ClusterLeaseClient {
	return &ClusterLeaseClient{
		client: resource.NewTypedClient[*ClusterLease, *ClusterLeaseList](client, ClusterLeaseKind()),
	}
}

func NewClusterLeaseClientFromGenerator(generator resource.ClientGenerator) (*ClusterLeaseClient, error) {
	c, err := generator.ClientFor(ClusterLeaseKind())
	if err != nil {
		return nil, err
	}
	return NewClusterLeaseClient(c), nil
}

func (c *ClusterLeaseClient) Get(ctx context.Context, identifier resource.Identifier) (*ClusterLease, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ClusterLeaseClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ClusterLeaseList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ClusterLeaseClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ClusterLeaseList, error) {
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

func (c *ClusterLeaseClient) Create(ctx context.Context, obj *ClusterLease, opts resource.CreateOptions) (*ClusterLease, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ClusterLeaseKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ClusterLeaseClient) Update(ctx context.Context, obj *ClusterLease, opts resource.UpdateOptions) (*ClusterLease, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ClusterLeaseClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ClusterLease, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ClusterLeaseClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus ClusterLeaseStatus, opts resource.UpdateOptions) (*ClusterLease, error) {
	return c.client.Update(ctx, &ClusterLease{
		TypeMeta: metav1.TypeMeta{
			Kind:       ClusterLeaseKind().Kind(),
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

func (c *ClusterLeaseClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

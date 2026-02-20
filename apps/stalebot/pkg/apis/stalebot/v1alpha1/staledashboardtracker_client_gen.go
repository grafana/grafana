package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type StaleDashboardTrackerClient struct {
	client *resource.TypedClient[*StaleDashboardTracker, *StaleDashboardTrackerList]
}

func NewStaleDashboardTrackerClient(client resource.Client) *StaleDashboardTrackerClient {
	return &StaleDashboardTrackerClient{
		client: resource.NewTypedClient[*StaleDashboardTracker, *StaleDashboardTrackerList](client, StaleDashboardTrackerKind()),
	}
}

func NewStaleDashboardTrackerClientFromGenerator(generator resource.ClientGenerator) (*StaleDashboardTrackerClient, error) {
	c, err := generator.ClientFor(StaleDashboardTrackerKind())
	if err != nil {
		return nil, err
	}
	return NewStaleDashboardTrackerClient(c), nil
}

func (c *StaleDashboardTrackerClient) Get(ctx context.Context, identifier resource.Identifier) (*StaleDashboardTracker, error) {
	return c.client.Get(ctx, identifier)
}

func (c *StaleDashboardTrackerClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*StaleDashboardTrackerList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *StaleDashboardTrackerClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*StaleDashboardTrackerList, error) {
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

func (c *StaleDashboardTrackerClient) Create(ctx context.Context, obj *StaleDashboardTracker, opts resource.CreateOptions) (*StaleDashboardTracker, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = StaleDashboardTrackerKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *StaleDashboardTrackerClient) Update(ctx context.Context, obj *StaleDashboardTracker, opts resource.UpdateOptions) (*StaleDashboardTracker, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *StaleDashboardTrackerClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*StaleDashboardTracker, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *StaleDashboardTrackerClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus StaleDashboardTrackerStatus, opts resource.UpdateOptions) (*StaleDashboardTracker, error) {
	return c.client.Update(ctx, &StaleDashboardTracker{
		TypeMeta: metav1.TypeMeta{
			Kind:       StaleDashboardTrackerKind().Kind(),
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

func (c *StaleDashboardTrackerClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

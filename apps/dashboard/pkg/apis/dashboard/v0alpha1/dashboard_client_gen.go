package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type DashboardClient struct {
	client *resource.TypedClient[*Dashboard, *DashboardList]
}

func NewDashboardClient(client resource.Client) *DashboardClient {
	return &DashboardClient{
		client: resource.NewTypedClient[*Dashboard, *DashboardList](client, DashboardKind()),
	}
}

func NewDashboardClientFromGenerator(generator resource.ClientGenerator) (*DashboardClient, error) {
	c, err := generator.ClientFor(DashboardKind())
	if err != nil {
		return nil, err
	}
	return NewDashboardClient(c), nil
}

func (c *DashboardClient) Get(ctx context.Context, identifier resource.Identifier) (*Dashboard, error) {
	return c.client.Get(ctx, identifier)
}

func (c *DashboardClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*DashboardList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *DashboardClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*DashboardList, error) {
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

func (c *DashboardClient) Create(ctx context.Context, obj *Dashboard, opts resource.CreateOptions) (*Dashboard, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = DashboardKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *DashboardClient) Update(ctx context.Context, obj *Dashboard, opts resource.UpdateOptions) (*Dashboard, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *DashboardClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Dashboard, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *DashboardClient) UpdateStatus(ctx context.Context, newStatus DashboardStatus, opts resource.UpdateOptions) (*Dashboard, error) {
	return c.client.Update(ctx, &Dashboard{
		TypeMeta: metav1.TypeMeta{
			Kind:       DashboardKind().Kind(),
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

func (c *DashboardClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

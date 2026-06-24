package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type DashboardCompatibilityScoreClient struct {
	client *resource.TypedClient[*DashboardCompatibilityScore, *DashboardCompatibilityScoreList]
}

func NewDashboardCompatibilityScoreClient(client resource.Client) *DashboardCompatibilityScoreClient {
	return &DashboardCompatibilityScoreClient{
		client: resource.NewTypedClient[*DashboardCompatibilityScore, *DashboardCompatibilityScoreList](client, Kind()),
	}
}

func NewDashboardCompatibilityScoreClientFromGenerator(generator resource.ClientGenerator) (*DashboardCompatibilityScoreClient, error) {
	c, err := generator.ClientFor(Kind())
	if err != nil {
		return nil, err
	}
	return NewDashboardCompatibilityScoreClient(c), nil
}

func (c *DashboardCompatibilityScoreClient) Get(ctx context.Context, identifier resource.Identifier) (*DashboardCompatibilityScore, error) {
	return c.client.Get(ctx, identifier)
}

func (c *DashboardCompatibilityScoreClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*DashboardCompatibilityScoreList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *DashboardCompatibilityScoreClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*DashboardCompatibilityScoreList, error) {
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

func (c *DashboardCompatibilityScoreClient) Create(ctx context.Context, obj *DashboardCompatibilityScore, opts resource.CreateOptions) (*DashboardCompatibilityScore, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = Kind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *DashboardCompatibilityScoreClient) Update(ctx context.Context, obj *DashboardCompatibilityScore, opts resource.UpdateOptions) (*DashboardCompatibilityScore, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *DashboardCompatibilityScoreClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*DashboardCompatibilityScore, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *DashboardCompatibilityScoreClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus Status, opts resource.UpdateOptions) (*DashboardCompatibilityScore, error) {
	return c.client.Update(ctx, &DashboardCompatibilityScore{
		TypeMeta: metav1.TypeMeta{
			Kind:       Kind().Kind(),
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

func (c *DashboardCompatibilityScoreClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

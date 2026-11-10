package v2beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type DashboardPreferencesClient struct {
	client *resource.TypedClient[*DashboardPreferences, *DashboardPreferencesList]
}

func NewDashboardPreferencesClient(client resource.Client) *DashboardPreferencesClient {
	return &DashboardPreferencesClient{
		client: resource.NewTypedClient[*DashboardPreferences, *DashboardPreferencesList](client, DashboardPreferencesKind()),
	}
}

func NewDashboardPreferencesClientFromGenerator(generator resource.ClientGenerator) (*DashboardPreferencesClient, error) {
	c, err := generator.ClientFor(DashboardPreferencesKind())
	if err != nil {
		return nil, err
	}
	return NewDashboardPreferencesClient(c), nil
}

func (c *DashboardPreferencesClient) Get(ctx context.Context, identifier resource.Identifier) (*DashboardPreferences, error) {
	return c.client.Get(ctx, identifier)
}

func (c *DashboardPreferencesClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*DashboardPreferencesList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *DashboardPreferencesClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*DashboardPreferencesList, error) {
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

func (c *DashboardPreferencesClient) Create(ctx context.Context, obj *DashboardPreferences, opts resource.CreateOptions) (*DashboardPreferences, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = DashboardPreferencesKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *DashboardPreferencesClient) Update(ctx context.Context, obj *DashboardPreferences, opts resource.UpdateOptions) (*DashboardPreferences, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *DashboardPreferencesClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*DashboardPreferences, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *DashboardPreferencesClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

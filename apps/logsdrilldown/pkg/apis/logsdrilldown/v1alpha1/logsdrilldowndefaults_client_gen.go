package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type LogsDrilldownDefaultsClient struct {
	client *resource.TypedClient[*LogsDrilldownDefaults, *LogsDrilldownDefaultsList]
}

func NewLogsDrilldownDefaultsClient(client resource.Client) *LogsDrilldownDefaultsClient {
	return &LogsDrilldownDefaultsClient{
		client: resource.NewTypedClient[*LogsDrilldownDefaults, *LogsDrilldownDefaultsList](client, LogsDrilldownDefaultsKind()),
	}
}

func NewLogsDrilldownDefaultsClientFromGenerator(generator resource.ClientGenerator) (*LogsDrilldownDefaultsClient, error) {
	c, err := generator.ClientFor(LogsDrilldownDefaultsKind())
	if err != nil {
		return nil, err
	}
	return NewLogsDrilldownDefaultsClient(c), nil
}

func (c *LogsDrilldownDefaultsClient) Get(ctx context.Context, identifier resource.Identifier) (*LogsDrilldownDefaults, error) {
	return c.client.Get(ctx, identifier)
}

func (c *LogsDrilldownDefaultsClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsDrilldownDefaultsList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *LogsDrilldownDefaultsClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsDrilldownDefaultsList, error) {
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

func (c *LogsDrilldownDefaultsClient) Create(ctx context.Context, obj *LogsDrilldownDefaults, opts resource.CreateOptions) (*LogsDrilldownDefaults, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = LogsDrilldownDefaultsKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *LogsDrilldownDefaultsClient) Update(ctx context.Context, obj *LogsDrilldownDefaults, opts resource.UpdateOptions) (*LogsDrilldownDefaults, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *LogsDrilldownDefaultsClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*LogsDrilldownDefaults, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *LogsDrilldownDefaultsClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus LogsDrilldownDefaultsStatus, opts resource.UpdateOptions) (*LogsDrilldownDefaults, error) {
	return c.client.Update(ctx, &LogsDrilldownDefaults{
		TypeMeta: metav1.TypeMeta{
			Kind:       LogsDrilldownDefaultsKind().Kind(),
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

func (c *LogsDrilldownDefaultsClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

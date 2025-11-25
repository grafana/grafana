package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type LogsDrilldownDefaultColumnsClient struct {
	client *resource.TypedClient[*LogsDrilldownDefaultColumns, *LogsDrilldownDefaultColumnsList]
}

func NewLogsDrilldownDefaultColumnsClient(client resource.Client) *LogsDrilldownDefaultColumnsClient {
	return &LogsDrilldownDefaultColumnsClient{
		client: resource.NewTypedClient[*LogsDrilldownDefaultColumns, *LogsDrilldownDefaultColumnsList](client, Kind()),
	}
}

func NewLogsDrilldownDefaultColumnsClientFromGenerator(generator resource.ClientGenerator) (*LogsDrilldownDefaultColumnsClient, error) {
	c, err := generator.ClientFor(Kind())
	if err != nil {
		return nil, err
	}
	return NewLogsDrilldownDefaultColumnsClient(c), nil
}

func (c *LogsDrilldownDefaultColumnsClient) Get(ctx context.Context, identifier resource.Identifier) (*LogsDrilldownDefaultColumns, error) {
	return c.client.Get(ctx, identifier)
}

func (c *LogsDrilldownDefaultColumnsClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsDrilldownDefaultColumnsList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *LogsDrilldownDefaultColumnsClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsDrilldownDefaultColumnsList, error) {
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

func (c *LogsDrilldownDefaultColumnsClient) Create(ctx context.Context, obj *LogsDrilldownDefaultColumns, opts resource.CreateOptions) (*LogsDrilldownDefaultColumns, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = Kind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *LogsDrilldownDefaultColumnsClient) Update(ctx context.Context, obj *LogsDrilldownDefaultColumns, opts resource.UpdateOptions) (*LogsDrilldownDefaultColumns, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *LogsDrilldownDefaultColumnsClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*LogsDrilldownDefaultColumns, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *LogsDrilldownDefaultColumnsClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus Status, opts resource.UpdateOptions) (*LogsDrilldownDefaultColumns, error) {
	return c.client.Update(ctx, &LogsDrilldownDefaultColumns{
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

func (c *LogsDrilldownDefaultColumnsClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

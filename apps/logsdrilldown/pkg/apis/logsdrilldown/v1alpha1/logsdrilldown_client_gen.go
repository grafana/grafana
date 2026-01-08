package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type LogsDrilldownClient struct {
	client *resource.TypedClient[*LogsDrilldown, *LogsDrilldownList]
}

func NewLogsDrilldownClient(client resource.Client) *LogsDrilldownClient {
	return &LogsDrilldownClient{
		client: resource.NewTypedClient[*LogsDrilldown, *LogsDrilldownList](client, LogsDrilldownKind()),
	}
}

func NewLogsDrilldownClientFromGenerator(generator resource.ClientGenerator) (*LogsDrilldownClient, error) {
	c, err := generator.ClientFor(LogsDrilldownKind())
	if err != nil {
		return nil, err
	}
	return NewLogsDrilldownClient(c), nil
}

func (c *LogsDrilldownClient) Get(ctx context.Context, identifier resource.Identifier) (*LogsDrilldown, error) {
	return c.client.Get(ctx, identifier)
}

func (c *LogsDrilldownClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsDrilldownList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *LogsDrilldownClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsDrilldownList, error) {
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

func (c *LogsDrilldownClient) Create(ctx context.Context, obj *LogsDrilldown, opts resource.CreateOptions) (*LogsDrilldown, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = LogsDrilldownKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *LogsDrilldownClient) Update(ctx context.Context, obj *LogsDrilldown, opts resource.UpdateOptions) (*LogsDrilldown, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *LogsDrilldownClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*LogsDrilldown, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *LogsDrilldownClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus LogsDrilldownStatus, opts resource.UpdateOptions) (*LogsDrilldown, error) {
	return c.client.Update(ctx, &LogsDrilldown{
		TypeMeta: metav1.TypeMeta{
			Kind:       LogsDrilldownKind().Kind(),
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

func (c *LogsDrilldownClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

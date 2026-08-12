package v1beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type LogsDrilldownDefaultLabelsClient struct {
	client *resource.TypedClient[*LogsDrilldownDefaultLabels, *LogsDrilldownDefaultLabelsList]
}

func NewLogsDrilldownDefaultLabelsClient(client resource.Client) *LogsDrilldownDefaultLabelsClient {
	return &LogsDrilldownDefaultLabelsClient{
		client: resource.NewTypedClient[*LogsDrilldownDefaultLabels, *LogsDrilldownDefaultLabelsList](client, LogsDrilldownDefaultLabelsKind()),
	}
}

func NewLogsDrilldownDefaultLabelsClientFromGenerator(generator resource.ClientGenerator) (*LogsDrilldownDefaultLabelsClient, error) {
	c, err := generator.ClientFor(LogsDrilldownDefaultLabelsKind())
	if err != nil {
		return nil, err
	}
	return NewLogsDrilldownDefaultLabelsClient(c), nil
}

func (c *LogsDrilldownDefaultLabelsClient) Get(ctx context.Context, identifier resource.Identifier) (*LogsDrilldownDefaultLabels, error) {
	return c.client.Get(ctx, identifier)
}

func (c *LogsDrilldownDefaultLabelsClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsDrilldownDefaultLabelsList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *LogsDrilldownDefaultLabelsClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsDrilldownDefaultLabelsList, error) {
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

func (c *LogsDrilldownDefaultLabelsClient) Create(ctx context.Context, obj *LogsDrilldownDefaultLabels, opts resource.CreateOptions) (*LogsDrilldownDefaultLabels, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = LogsDrilldownDefaultLabelsKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *LogsDrilldownDefaultLabelsClient) Update(ctx context.Context, obj *LogsDrilldownDefaultLabels, opts resource.UpdateOptions) (*LogsDrilldownDefaultLabels, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *LogsDrilldownDefaultLabelsClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*LogsDrilldownDefaultLabels, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *LogsDrilldownDefaultLabelsClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus LogsDrilldownDefaultLabelsStatus, opts resource.UpdateOptions) (*LogsDrilldownDefaultLabels, error) {
	return c.client.Update(ctx, &LogsDrilldownDefaultLabels{
		TypeMeta: metav1.TypeMeta{
			Kind:       LogsDrilldownDefaultLabelsKind().Kind(),
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

func (c *LogsDrilldownDefaultLabelsClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

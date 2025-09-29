package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type TimeIntervalClient struct {
	client *resource.TypedClient[*TimeInterval, *TimeIntervalList]
}

func NewTimeIntervalClient(client resource.Client) *TimeIntervalClient {
	return &TimeIntervalClient{
		client: resource.NewTypedClient[*TimeInterval, *TimeIntervalList](client, TimeIntervalKind()),
	}
}

func NewTimeIntervalClientFromGenerator(generator resource.ClientGenerator) (*TimeIntervalClient, error) {
	c, err := generator.ClientFor(TimeIntervalKind())
	if err != nil {
		return nil, err
	}
	return NewTimeIntervalClient(c), nil
}

func (c *TimeIntervalClient) Get(ctx context.Context, identifier resource.Identifier) (*TimeInterval, error) {
	return c.client.Get(ctx, identifier)
}

func (c *TimeIntervalClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*TimeIntervalList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *TimeIntervalClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*TimeIntervalList, error) {
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

func (c *TimeIntervalClient) Create(ctx context.Context, obj *TimeInterval, opts resource.CreateOptions) (*TimeInterval, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = TimeIntervalKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *TimeIntervalClient) Update(ctx context.Context, obj *TimeInterval, opts resource.UpdateOptions) (*TimeInterval, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *TimeIntervalClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*TimeInterval, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *TimeIntervalClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus TimeIntervalStatus, opts resource.UpdateOptions) (*TimeInterval, error) {
	return c.client.Update(ctx, &TimeInterval{
		TypeMeta: metav1.TypeMeta{
			Kind:       TimeIntervalKind().Kind(),
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

func (c *TimeIntervalClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

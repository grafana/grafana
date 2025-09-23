package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type StarsClient struct {
	client *resource.TypedClient[*Stars, *StarsList]
}

func NewStarsClient(client resource.Client) *StarsClient {
	return &StarsClient{
		client: resource.NewTypedClient[*Stars, *StarsList](client, StarsKind()),
	}
}

func NewStarsClientFromGenerator(generator resource.ClientGenerator) (*StarsClient, error) {
	c, err := generator.ClientFor(StarsKind())
	if err != nil {
		return nil, err
	}
	return NewStarsClient(c), nil
}

func (c *StarsClient) Get(ctx context.Context, identifier resource.Identifier) (*Stars, error) {
	return c.client.Get(ctx, identifier)
}

func (c *StarsClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*StarsList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *StarsClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*StarsList, error) {
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

func (c *StarsClient) Create(ctx context.Context, obj *Stars, opts resource.CreateOptions) (*Stars, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = StarsKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *StarsClient) Update(ctx context.Context, obj *Stars, opts resource.UpdateOptions) (*Stars, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *StarsClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Stars, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *StarsClient) UpdateStatus(ctx context.Context, newStatus StarsStatus, opts resource.UpdateOptions) (*Stars, error) {
	return c.client.Update(ctx, &Stars{
		TypeMeta: metav1.TypeMeta{
			Kind:       StarsKind().Kind(),
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

func (c *StarsClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

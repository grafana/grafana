package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ShortURLClient struct {
	client *resource.TypedClient[*ShortURL, *ShortURLList]
}

func NewShortURLClient(client resource.Client) *ShortURLClient {
	return &ShortURLClient{
		client: resource.NewTypedClient[*ShortURL, *ShortURLList](client, ShortURLKind()),
	}
}

func NewShortURLClientFromGenerator(generator resource.ClientGenerator) (*ShortURLClient, error) {
	c, err := generator.ClientFor(ShortURLKind())
	if err != nil {
		return nil, err
	}
	return NewShortURLClient(c), nil
}

func (c *ShortURLClient) Get(ctx context.Context, identifier resource.Identifier) (*ShortURL, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ShortURLClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ShortURLList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ShortURLClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ShortURLList, error) {
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

func (c *ShortURLClient) Create(ctx context.Context, obj *ShortURL, opts resource.CreateOptions) (*ShortURL, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ShortURLKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ShortURLClient) Update(ctx context.Context, obj *ShortURL, opts resource.UpdateOptions) (*ShortURL, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ShortURLClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ShortURL, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ShortURLClient) UpdateStatus(ctx context.Context, newStatus ShortURLStatus, opts resource.UpdateOptions) (*ShortURL, error) {
	return c.client.Update(ctx, &ShortURL{
		TypeMeta: metav1.TypeMeta{
			Kind:       ShortURLKind().Kind(),
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

func (c *ShortURLClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

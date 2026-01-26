package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type MetaClient struct {
	client *resource.TypedClient[*Meta, *MetaList]
}

func NewMetaClient(client resource.Client) *MetaClient {
	return &MetaClient{
		client: resource.NewTypedClient[*Meta, *MetaList](client, MetaKind()),
	}
}

func NewMetaClientFromGenerator(generator resource.ClientGenerator) (*MetaClient, error) {
	c, err := generator.ClientFor(MetaKind())
	if err != nil {
		return nil, err
	}
	return NewMetaClient(c), nil
}

func (c *MetaClient) Get(ctx context.Context, identifier resource.Identifier) (*Meta, error) {
	return c.client.Get(ctx, identifier)
}

func (c *MetaClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*MetaList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *MetaClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*MetaList, error) {
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

func (c *MetaClient) Create(ctx context.Context, obj *Meta, opts resource.CreateOptions) (*Meta, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = MetaKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *MetaClient) Update(ctx context.Context, obj *Meta, opts resource.UpdateOptions) (*Meta, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *MetaClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Meta, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *MetaClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus MetaStatus, opts resource.UpdateOptions) (*Meta, error) {
	return c.client.Update(ctx, &Meta{
		TypeMeta: metav1.TypeMeta{
			Kind:       MetaKind().Kind(),
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

func (c *MetaClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

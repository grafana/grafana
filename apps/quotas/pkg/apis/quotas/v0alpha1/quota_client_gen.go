package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type QuotaClient struct {
	client *resource.TypedClient[*Quota, *QuotaList]
}

func NewQuotaClient(client resource.Client) *QuotaClient {
	return &QuotaClient{
		client: resource.NewTypedClient[*Quota, *QuotaList](client, QuotaKind()),
	}
}

func NewQuotaClientFromGenerator(generator resource.ClientGenerator) (*QuotaClient, error) {
	c, err := generator.ClientFor(QuotaKind())
	if err != nil {
		return nil, err
	}
	return NewQuotaClient(c), nil
}

func (c *QuotaClient) Get(ctx context.Context, identifier resource.Identifier) (*Quota, error) {
	return c.client.Get(ctx, identifier)
}

func (c *QuotaClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*QuotaList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *QuotaClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*QuotaList, error) {
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

func (c *QuotaClient) Create(ctx context.Context, obj *Quota, opts resource.CreateOptions) (*Quota, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = QuotaKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *QuotaClient) Update(ctx context.Context, obj *Quota, opts resource.UpdateOptions) (*Quota, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *QuotaClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Quota, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *QuotaClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus QuotaStatus, opts resource.UpdateOptions) (*Quota, error) {
	return c.client.Update(ctx, &Quota{
		TypeMeta: metav1.TypeMeta{
			Kind:       QuotaKind().Kind(),
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

func (c *QuotaClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

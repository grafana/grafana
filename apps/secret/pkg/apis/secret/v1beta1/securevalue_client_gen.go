package v1beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type SecureValueClient struct {
	client *resource.TypedClient[*SecureValue, *SecureValueList]
}

func NewSecureValueClient(client resource.Client) *SecureValueClient {
	return &SecureValueClient{
		client: resource.NewTypedClient[*SecureValue, *SecureValueList](client, SecureValueKind()),
	}
}

func NewSecureValueClientFromGenerator(generator resource.ClientGenerator) (*SecureValueClient, error) {
	c, err := generator.ClientFor(SecureValueKind())
	if err != nil {
		return nil, err
	}
	return NewSecureValueClient(c), nil
}

func (c *SecureValueClient) Get(ctx context.Context, identifier resource.Identifier) (*SecureValue, error) {
	return c.client.Get(ctx, identifier)
}

func (c *SecureValueClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*SecureValueList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *SecureValueClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*SecureValueList, error) {
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

func (c *SecureValueClient) Create(ctx context.Context, obj *SecureValue, opts resource.CreateOptions) (*SecureValue, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = SecureValueKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *SecureValueClient) Update(ctx context.Context, obj *SecureValue, opts resource.UpdateOptions) (*SecureValue, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *SecureValueClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*SecureValue, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *SecureValueClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus SecureValueStatus, opts resource.UpdateOptions) (*SecureValue, error) {
	return c.client.Update(ctx, &SecureValue{
		TypeMeta: metav1.TypeMeta{
			Kind:       SecureValueKind().Kind(),
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

func (c *SecureValueClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

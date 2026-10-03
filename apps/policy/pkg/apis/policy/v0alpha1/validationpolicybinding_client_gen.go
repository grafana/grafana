package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ValidationPolicyBindingClient struct {
	client *resource.TypedClient[*ValidationPolicyBinding, *ValidationPolicyBindingList]
}

func NewValidationPolicyBindingClient(client resource.Client) *ValidationPolicyBindingClient {
	return &ValidationPolicyBindingClient{
		client: resource.NewTypedClient[*ValidationPolicyBinding, *ValidationPolicyBindingList](client, ValidationPolicyBindingKind()),
	}
}

func NewValidationPolicyBindingClientFromGenerator(generator resource.ClientGenerator) (*ValidationPolicyBindingClient, error) {
	c, err := generator.ClientFor(ValidationPolicyBindingKind())
	if err != nil {
		return nil, err
	}
	return NewValidationPolicyBindingClient(c), nil
}

func (c *ValidationPolicyBindingClient) Get(ctx context.Context, identifier resource.Identifier) (*ValidationPolicyBinding, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ValidationPolicyBindingClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ValidationPolicyBindingList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ValidationPolicyBindingClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ValidationPolicyBindingList, error) {
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

func (c *ValidationPolicyBindingClient) Create(ctx context.Context, obj *ValidationPolicyBinding, opts resource.CreateOptions) (*ValidationPolicyBinding, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ValidationPolicyBindingKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ValidationPolicyBindingClient) Update(ctx context.Context, obj *ValidationPolicyBinding, opts resource.UpdateOptions) (*ValidationPolicyBinding, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ValidationPolicyBindingClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ValidationPolicyBinding, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ValidationPolicyBindingClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus ValidationPolicyBindingStatus, opts resource.UpdateOptions) (*ValidationPolicyBinding, error) {
	return c.client.Update(ctx, &ValidationPolicyBinding{
		TypeMeta: metav1.TypeMeta{
			Kind:       ValidationPolicyBindingKind().Kind(),
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

func (c *ValidationPolicyBindingClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

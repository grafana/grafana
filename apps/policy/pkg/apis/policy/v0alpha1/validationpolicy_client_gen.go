package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ValidationPolicyClient struct {
	client *resource.TypedClient[*ValidationPolicy, *ValidationPolicyList]
}

func NewValidationPolicyClient(client resource.Client) *ValidationPolicyClient {
	return &ValidationPolicyClient{
		client: resource.NewTypedClient[*ValidationPolicy, *ValidationPolicyList](client, ValidationPolicyKind()),
	}
}

func NewValidationPolicyClientFromGenerator(generator resource.ClientGenerator) (*ValidationPolicyClient, error) {
	c, err := generator.ClientFor(ValidationPolicyKind())
	if err != nil {
		return nil, err
	}
	return NewValidationPolicyClient(c), nil
}

func (c *ValidationPolicyClient) Get(ctx context.Context, identifier resource.Identifier) (*ValidationPolicy, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ValidationPolicyClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ValidationPolicyList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ValidationPolicyClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ValidationPolicyList, error) {
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

func (c *ValidationPolicyClient) Create(ctx context.Context, obj *ValidationPolicy, opts resource.CreateOptions) (*ValidationPolicy, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ValidationPolicyKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ValidationPolicyClient) Update(ctx context.Context, obj *ValidationPolicy, opts resource.UpdateOptions) (*ValidationPolicy, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ValidationPolicyClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ValidationPolicy, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ValidationPolicyClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus ValidationPolicyStatus, opts resource.UpdateOptions) (*ValidationPolicy, error) {
	return c.client.Update(ctx, &ValidationPolicy{
		TypeMeta: metav1.TypeMeta{
			Kind:       ValidationPolicyKind().Kind(),
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

func (c *ValidationPolicyClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

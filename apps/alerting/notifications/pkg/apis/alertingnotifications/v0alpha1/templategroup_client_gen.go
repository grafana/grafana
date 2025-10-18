package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type TemplateGroupClient struct {
	client *resource.TypedClient[*TemplateGroup, *TemplateGroupList]
}

func NewTemplateGroupClient(client resource.Client) *TemplateGroupClient {
	return &TemplateGroupClient{
		client: resource.NewTypedClient[*TemplateGroup, *TemplateGroupList](client, TemplateGroupKind()),
	}
}

func NewTemplateGroupClientFromGenerator(generator resource.ClientGenerator) (*TemplateGroupClient, error) {
	c, err := generator.ClientFor(TemplateGroupKind())
	if err != nil {
		return nil, err
	}
	return NewTemplateGroupClient(c), nil
}

func (c *TemplateGroupClient) Get(ctx context.Context, identifier resource.Identifier) (*TemplateGroup, error) {
	return c.client.Get(ctx, identifier)
}

func (c *TemplateGroupClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*TemplateGroupList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *TemplateGroupClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*TemplateGroupList, error) {
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

func (c *TemplateGroupClient) Create(ctx context.Context, obj *TemplateGroup, opts resource.CreateOptions) (*TemplateGroup, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = TemplateGroupKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *TemplateGroupClient) Update(ctx context.Context, obj *TemplateGroup, opts resource.UpdateOptions) (*TemplateGroup, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *TemplateGroupClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*TemplateGroup, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *TemplateGroupClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus TemplateGroupStatus, opts resource.UpdateOptions) (*TemplateGroup, error) {
	return c.client.Update(ctx, &TemplateGroup{
		TypeMeta: metav1.TypeMeta{
			Kind:       TemplateGroupKind().Kind(),
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

func (c *TemplateGroupClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

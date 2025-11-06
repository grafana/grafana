package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type AnnotationClient struct {
	client *resource.TypedClient[*Annotation, *AnnotationList]
}

func NewAnnotationClient(client resource.Client) *AnnotationClient {
	return &AnnotationClient{
		client: resource.NewTypedClient[*Annotation, *AnnotationList](client, AnnotationKind()),
	}
}

func NewAnnotationClientFromGenerator(generator resource.ClientGenerator) (*AnnotationClient, error) {
	c, err := generator.ClientFor(AnnotationKind())
	if err != nil {
		return nil, err
	}
	return NewAnnotationClient(c), nil
}

func (c *AnnotationClient) Get(ctx context.Context, identifier resource.Identifier) (*Annotation, error) {
	return c.client.Get(ctx, identifier)
}

func (c *AnnotationClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*AnnotationList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *AnnotationClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*AnnotationList, error) {
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

func (c *AnnotationClient) Create(ctx context.Context, obj *Annotation, opts resource.CreateOptions) (*Annotation, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = AnnotationKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *AnnotationClient) Update(ctx context.Context, obj *Annotation, opts resource.UpdateOptions) (*Annotation, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *AnnotationClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Annotation, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *AnnotationClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus AnnotationStatus, opts resource.UpdateOptions) (*Annotation, error) {
	return c.client.Update(ctx, &Annotation{
		TypeMeta: metav1.TypeMeta{
			Kind:       AnnotationKind().Kind(),
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

func (c *AnnotationClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

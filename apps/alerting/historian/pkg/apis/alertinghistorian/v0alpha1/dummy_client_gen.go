package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type DummyClient struct {
	client *resource.TypedClient[*Dummy, *DummyList]
}

func NewDummyClient(client resource.Client) *DummyClient {
	return &DummyClient{
		client: resource.NewTypedClient[*Dummy, *DummyList](client, DummyKind()),
	}
}

func NewDummyClientFromGenerator(generator resource.ClientGenerator) (*DummyClient, error) {
	c, err := generator.ClientFor(DummyKind())
	if err != nil {
		return nil, err
	}
	return NewDummyClient(c), nil
}

func (c *DummyClient) Get(ctx context.Context, identifier resource.Identifier) (*Dummy, error) {
	return c.client.Get(ctx, identifier)
}

func (c *DummyClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*DummyList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *DummyClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*DummyList, error) {
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

func (c *DummyClient) Create(ctx context.Context, obj *Dummy, opts resource.CreateOptions) (*Dummy, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = DummyKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *DummyClient) Update(ctx context.Context, obj *Dummy, opts resource.UpdateOptions) (*Dummy, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *DummyClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Dummy, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *DummyClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus DummyStatus, opts resource.UpdateOptions) (*Dummy, error) {
	return c.client.Update(ctx, &Dummy{
		TypeMeta: metav1.TypeMeta{
			Kind:       DummyKind().Kind(),
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

func (c *DummyClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

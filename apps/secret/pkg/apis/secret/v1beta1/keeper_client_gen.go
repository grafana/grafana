package v1beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type KeeperClient struct {
	client *resource.TypedClient[*Keeper, *KeeperList]
}

func NewKeeperClient(client resource.Client) *KeeperClient {
	return &KeeperClient{
		client: resource.NewTypedClient[*Keeper, *KeeperList](client, KeeperKind()),
	}
}

func NewKeeperClientFromGenerator(generator resource.ClientGenerator) (*KeeperClient, error) {
	c, err := generator.ClientFor(KeeperKind())
	if err != nil {
		return nil, err
	}
	return NewKeeperClient(c), nil
}

func (c *KeeperClient) Get(ctx context.Context, identifier resource.Identifier) (*Keeper, error) {
	return c.client.Get(ctx, identifier)
}

func (c *KeeperClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*KeeperList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *KeeperClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*KeeperList, error) {
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

func (c *KeeperClient) Create(ctx context.Context, obj *Keeper, opts resource.CreateOptions) (*Keeper, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = KeeperKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *KeeperClient) Update(ctx context.Context, obj *Keeper, opts resource.UpdateOptions) (*Keeper, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *KeeperClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Keeper, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *KeeperClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus KeeperStatus, opts resource.UpdateOptions) (*Keeper, error) {
	return c.client.Update(ctx, &Keeper{
		TypeMeta: metav1.TypeMeta{
			Kind:       KeeperKind().Kind(),
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

func (c *KeeperClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

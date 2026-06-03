package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type NotificationClient struct {
	client *resource.TypedClient[*Notification, *NotificationList]
}

func NewNotificationClient(client resource.Client) *NotificationClient {
	return &NotificationClient{
		client: resource.NewTypedClient[*Notification, *NotificationList](client, NotificationKind()),
	}
}

func NewNotificationClientFromGenerator(generator resource.ClientGenerator) (*NotificationClient, error) {
	c, err := generator.ClientFor(NotificationKind())
	if err != nil {
		return nil, err
	}
	return NewNotificationClient(c), nil
}

func (c *NotificationClient) Get(ctx context.Context, identifier resource.Identifier) (*Notification, error) {
	return c.client.Get(ctx, identifier)
}

func (c *NotificationClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*NotificationList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *NotificationClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*NotificationList, error) {
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

func (c *NotificationClient) Create(ctx context.Context, obj *Notification, opts resource.CreateOptions) (*Notification, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = NotificationKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *NotificationClient) Update(ctx context.Context, obj *Notification, opts resource.UpdateOptions) (*Notification, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *NotificationClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Notification, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *NotificationClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus NotificationStatus, opts resource.UpdateOptions) (*Notification, error) {
	return c.client.Update(ctx, &Notification{
		TypeMeta: metav1.TypeMeta{
			Kind:       NotificationKind().Kind(),
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

func (c *NotificationClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

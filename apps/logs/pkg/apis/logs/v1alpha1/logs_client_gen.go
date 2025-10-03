package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type LogsClient struct {
	client *resource.TypedClient[*Logs, *LogsList]
}

func NewLogsClient(client resource.Client) *LogsClient {
	return &LogsClient{
		client: resource.NewTypedClient[*Logs, *LogsList](client, LogsKind()),
	}
}

func NewLogsClientFromGenerator(generator resource.ClientGenerator) (*LogsClient, error) {
	c, err := generator.ClientFor(LogsKind())
	if err != nil {
		return nil, err
	}
	return NewLogsClient(c), nil
}

func (c *LogsClient) Get(ctx context.Context, identifier resource.Identifier) (*Logs, error) {
	return c.client.Get(ctx, identifier)
}

func (c *LogsClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *LogsClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*LogsList, error) {
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

func (c *LogsClient) Create(ctx context.Context, obj *Logs, opts resource.CreateOptions) (*Logs, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = LogsKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *LogsClient) Update(ctx context.Context, obj *Logs, opts resource.UpdateOptions) (*Logs, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *LogsClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Logs, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *LogsClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus LogsStatus, opts resource.UpdateOptions) (*Logs, error) {
	return c.client.Update(ctx, &Logs{
		TypeMeta: metav1.TypeMeta{
			Kind:       LogsKind().Kind(),
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

func (c *LogsClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

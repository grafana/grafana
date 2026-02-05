package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ConnectionClient struct {
	client *resource.TypedClient[*Connection, *ConnectionList]
}

func NewConnectionClient(client resource.Client) *ConnectionClient {
	return &ConnectionClient{
		client: resource.NewTypedClient[*Connection, *ConnectionList](client, ConnectionKind()),
	}
}

func NewConnectionClientFromGenerator(generator resource.ClientGenerator) (*ConnectionClient, error) {
	c, err := generator.ClientFor(ConnectionKind())
	if err != nil {
		return nil, err
	}
	return NewConnectionClient(c), nil
}

func (c *ConnectionClient) Get(ctx context.Context, identifier resource.Identifier) (*Connection, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ConnectionClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ConnectionList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ConnectionClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ConnectionList, error) {
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

func (c *ConnectionClient) Create(ctx context.Context, obj *Connection, opts resource.CreateOptions) (*Connection, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ConnectionKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ConnectionClient) Update(ctx context.Context, obj *Connection, opts resource.UpdateOptions) (*Connection, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ConnectionClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Connection, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ConnectionClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

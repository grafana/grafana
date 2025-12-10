package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type SnapshotClient struct {
	client *resource.TypedClient[*Snapshot, *SnapshotList]
}

func NewSnapshotClient(client resource.Client) *SnapshotClient {
	return &SnapshotClient{
		client: resource.NewTypedClient[*Snapshot, *SnapshotList](client, SnapshotKind()),
	}
}

func NewSnapshotClientFromGenerator(generator resource.ClientGenerator) (*SnapshotClient, error) {
	c, err := generator.ClientFor(SnapshotKind())
	if err != nil {
		return nil, err
	}
	return NewSnapshotClient(c), nil
}

func (c *SnapshotClient) Get(ctx context.Context, identifier resource.Identifier) (*Snapshot, error) {
	return c.client.Get(ctx, identifier)
}

func (c *SnapshotClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*SnapshotList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *SnapshotClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*SnapshotList, error) {
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

func (c *SnapshotClient) Create(ctx context.Context, obj *Snapshot, opts resource.CreateOptions) (*Snapshot, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = SnapshotKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *SnapshotClient) Update(ctx context.Context, obj *Snapshot, opts resource.UpdateOptions) (*Snapshot, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *SnapshotClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Snapshot, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *SnapshotClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

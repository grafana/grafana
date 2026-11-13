package v1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type PendingFolderDeletionClient struct {
	client *resource.TypedClient[*PendingFolderDeletion, *PendingFolderDeletionList]
}

func NewPendingFolderDeletionClient(client resource.Client) *PendingFolderDeletionClient {
	return &PendingFolderDeletionClient{
		client: resource.NewTypedClient[*PendingFolderDeletion, *PendingFolderDeletionList](client, PendingFolderDeletionKind()),
	}
}

func NewPendingFolderDeletionClientFromGenerator(generator resource.ClientGenerator) (*PendingFolderDeletionClient, error) {
	c, err := generator.ClientFor(PendingFolderDeletionKind())
	if err != nil {
		return nil, err
	}
	return NewPendingFolderDeletionClient(c), nil
}

func (c *PendingFolderDeletionClient) Get(ctx context.Context, identifier resource.Identifier) (*PendingFolderDeletion, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PendingFolderDeletionClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PendingFolderDeletionList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PendingFolderDeletionClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PendingFolderDeletionList, error) {
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

func (c *PendingFolderDeletionClient) Create(ctx context.Context, obj *PendingFolderDeletion, opts resource.CreateOptions) (*PendingFolderDeletion, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PendingFolderDeletionKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PendingFolderDeletionClient) Update(ctx context.Context, obj *PendingFolderDeletion, opts resource.UpdateOptions) (*PendingFolderDeletion, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PendingFolderDeletionClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*PendingFolderDeletion, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PendingFolderDeletionClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v1beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type FolderClient struct {
	client *resource.TypedClient[*Folder, *FolderList]
}

func NewFolderClient(client resource.Client) *FolderClient {
	return &FolderClient{
		client: resource.NewTypedClient[*Folder, *FolderList](client, FolderKind()),
	}
}

func NewFolderClientFromGenerator(generator resource.ClientGenerator) (*FolderClient, error) {
	c, err := generator.ClientFor(FolderKind())
	if err != nil {
		return nil, err
	}
	return NewFolderClient(c), nil
}

func (c *FolderClient) Get(ctx context.Context, identifier resource.Identifier) (*Folder, error) {
	return c.client.Get(ctx, identifier)
}

func (c *FolderClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*FolderList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *FolderClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*FolderList, error) {
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

func (c *FolderClient) Create(ctx context.Context, obj *Folder, opts resource.CreateOptions) (*Folder, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = FolderKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *FolderClient) Update(ctx context.Context, obj *Folder, opts resource.UpdateOptions) (*Folder, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *FolderClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Folder, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *FolderClient) UpdateStatus(ctx context.Context, newStatus FolderStatus, opts resource.UpdateOptions) (*Folder, error) {
	return c.client.Update(ctx, &Folder{
		TypeMeta: metav1.TypeMeta{
			Kind:       FolderKind().Kind(),
			APIVersion: GroupVersion.Identifier(),
		},
		ObjectMeta: metav1.ObjectMeta{
			ResourceVersion: opts.ResourceVersion,
		},
		Status: newStatus,
	}, resource.UpdateOptions{
		Subresource:     "status",
		ResourceVersion: opts.ResourceVersion,
	})
}

func (c *FolderClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

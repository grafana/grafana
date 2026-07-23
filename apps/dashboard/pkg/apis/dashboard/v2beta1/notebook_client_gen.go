package v2beta1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type NotebookClient struct {
	client *resource.TypedClient[*Notebook, *NotebookList]
}

func NewNotebookClient(client resource.Client) *NotebookClient {
	return &NotebookClient{
		client: resource.NewTypedClient[*Notebook, *NotebookList](client, NotebookKind()),
	}
}

func NewNotebookClientFromGenerator(generator resource.ClientGenerator) (*NotebookClient, error) {
	c, err := generator.ClientFor(NotebookKind())
	if err != nil {
		return nil, err
	}
	return NewNotebookClient(c), nil
}

func (c *NotebookClient) Get(ctx context.Context, identifier resource.Identifier) (*Notebook, error) {
	return c.client.Get(ctx, identifier)
}

func (c *NotebookClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*NotebookList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *NotebookClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*NotebookList, error) {
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

func (c *NotebookClient) Create(ctx context.Context, obj *Notebook, opts resource.CreateOptions) (*Notebook, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = NotebookKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *NotebookClient) Update(ctx context.Context, obj *Notebook, opts resource.UpdateOptions) (*Notebook, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *NotebookClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Notebook, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *NotebookClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

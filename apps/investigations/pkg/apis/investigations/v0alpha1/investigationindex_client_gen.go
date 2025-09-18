package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type InvestigationIndexClient struct {
	client *resource.TypedClient[*InvestigationIndex, *InvestigationIndexList]
}

func NewInvestigationIndexClient(client resource.Client) *InvestigationIndexClient {
	return &InvestigationIndexClient{
		client: resource.NewTypedClient[*InvestigationIndex, *InvestigationIndexList](client, InvestigationIndexKind()),
	}
}

func NewInvestigationIndexClientFromGenerator(generator resource.ClientGenerator) (*InvestigationIndexClient, error) {
	c, err := generator.ClientFor(InvestigationIndexKind())
	if err != nil {
		return nil, err
	}
	return NewInvestigationIndexClient(c), nil
}

func (c *InvestigationIndexClient) Get(ctx context.Context, identifier resource.Identifier) (*InvestigationIndex, error) {
	return c.client.Get(ctx, identifier)
}

func (c *InvestigationIndexClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*InvestigationIndexList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *InvestigationIndexClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*InvestigationIndexList, error) {
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

func (c *InvestigationIndexClient) Create(ctx context.Context, obj *InvestigationIndex, opts resource.CreateOptions) (*InvestigationIndex, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = InvestigationIndexKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *InvestigationIndexClient) Update(ctx context.Context, obj *InvestigationIndex, opts resource.UpdateOptions) (*InvestigationIndex, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *InvestigationIndexClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*InvestigationIndex, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *InvestigationIndexClient) UpdateStatus(ctx context.Context, newStatus InvestigationIndexStatus, opts resource.UpdateOptions) (*InvestigationIndex, error) {
	return c.client.Update(ctx, &InvestigationIndex{
		TypeMeta: metav1.TypeMeta{
			Kind:       InvestigationIndexKind().Kind(),
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

func (c *InvestigationIndexClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

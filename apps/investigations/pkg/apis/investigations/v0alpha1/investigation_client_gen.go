package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type InvestigationClient struct {
	client *resource.TypedClient[*Investigation, *InvestigationList]
}

func NewInvestigationClient(client resource.Client) *InvestigationClient {
	return &InvestigationClient{
		client: resource.NewTypedClient[*Investigation, *InvestigationList](client, InvestigationKind()),
	}
}

func NewInvestigationClientFromGenerator(generator resource.ClientGenerator) (*InvestigationClient, error) {
	c, err := generator.ClientFor(InvestigationKind())
	if err != nil {
		return nil, err
	}
	return NewInvestigationClient(c), nil
}

func (c *InvestigationClient) Get(ctx context.Context, identifier resource.Identifier) (*Investigation, error) {
	return c.client.Get(ctx, identifier)
}

func (c *InvestigationClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*InvestigationList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *InvestigationClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*InvestigationList, error) {
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

func (c *InvestigationClient) Create(ctx context.Context, obj *Investigation, opts resource.CreateOptions) (*Investigation, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = InvestigationKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *InvestigationClient) Update(ctx context.Context, obj *Investigation, opts resource.UpdateOptions) (*Investigation, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *InvestigationClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Investigation, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *InvestigationClient) UpdateStatus(ctx context.Context, newStatus InvestigationStatus, opts resource.UpdateOptions) (*Investigation, error) {
	return c.client.Update(ctx, &Investigation{
		TypeMeta: metav1.TypeMeta{
			Kind:       InvestigationKind().Kind(),
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

func (c *InvestigationClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

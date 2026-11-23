package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:openapi-gen=false
type HistoricJobClient struct {
	client *resource.TypedClient[*HistoricJob, *HistoricJobList]
}

func NewHistoricJobClient(client resource.Client) *HistoricJobClient {
	return &HistoricJobClient{
		client: resource.NewTypedClient[*HistoricJob, *HistoricJobList](client, HistoricJobKind()),
	}
}

func NewHistoricJobClientFromGenerator(generator resource.ClientGenerator) (*HistoricJobClient, error) {
	c, err := generator.ClientFor(HistoricJobKind())
	if err != nil {
		return nil, err
	}
	return NewHistoricJobClient(c), nil
}

func (c *HistoricJobClient) Get(ctx context.Context, identifier resource.Identifier) (*HistoricJob, error) {
	return c.client.Get(ctx, identifier)
}

func (c *HistoricJobClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*HistoricJobList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *HistoricJobClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*HistoricJobList, error) {
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

func (c *HistoricJobClient) Create(ctx context.Context, obj *HistoricJob, opts resource.CreateOptions) (*HistoricJob, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = HistoricJobKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *HistoricJobClient) Update(ctx context.Context, obj *HistoricJob, opts resource.UpdateOptions) (*HistoricJob, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *HistoricJobClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*HistoricJob, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *HistoricJobClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus HistoricJobStatus, opts resource.UpdateOptions) (*HistoricJob, error) {
	return c.client.Update(ctx, &HistoricJob{
		TypeMeta: metav1.TypeMeta{
			Kind:       HistoricJobKind().Kind(),
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

func (c *HistoricJobClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

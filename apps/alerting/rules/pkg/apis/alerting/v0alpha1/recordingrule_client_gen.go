package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type RecordingRuleClient struct {
	client *resource.TypedClient[*RecordingRule, *RecordingRuleList]
}

func NewRecordingRuleClient(client resource.Client) *RecordingRuleClient {
	return &RecordingRuleClient{
		client: resource.NewTypedClient[*RecordingRule, *RecordingRuleList](client, RecordingRuleKind()),
	}
}

func NewRecordingRuleClientFromGenerator(generator resource.ClientGenerator) (*RecordingRuleClient, error) {
	c, err := generator.ClientFor(RecordingRuleKind())
	if err != nil {
		return nil, err
	}
	return NewRecordingRuleClient(c), nil
}

func (c *RecordingRuleClient) Get(ctx context.Context, identifier resource.Identifier) (*RecordingRule, error) {
	return c.client.Get(ctx, identifier)
}

func (c *RecordingRuleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*RecordingRuleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *RecordingRuleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*RecordingRuleList, error) {
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

func (c *RecordingRuleClient) Create(ctx context.Context, obj *RecordingRule, opts resource.CreateOptions) (*RecordingRule, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = RecordingRuleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *RecordingRuleClient) Update(ctx context.Context, obj *RecordingRule, opts resource.UpdateOptions) (*RecordingRule, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *RecordingRuleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*RecordingRule, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *RecordingRuleClient) UpdateStatus(ctx context.Context, newStatus RecordingRuleStatus, opts resource.UpdateOptions) (*RecordingRule, error) {
	return c.client.Update(ctx, &RecordingRule{
		TypeMeta: metav1.TypeMeta{
			Kind:       RecordingRuleKind().Kind(),
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

func (c *RecordingRuleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

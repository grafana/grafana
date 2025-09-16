package v1alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PreferencesClient struct {
	client *resource.TypedClient[*Preferences, *PreferencesList]
}

func NewPreferencesClient(client resource.Client) *PreferencesClient {
	return &PreferencesClient{
		client: resource.NewTypedClient[*Preferences, *PreferencesList](client, PreferencesKind()),
	}
}

func NewPreferencesClientFromGenerator(generator resource.ClientGenerator) (*PreferencesClient, error) {
	c, err := generator.ClientFor(PreferencesKind())
	if err != nil {
		return nil, err
	}
	return NewPreferencesClient(c), nil
}

func (c *PreferencesClient) Get(ctx context.Context, identifier resource.Identifier) (*Preferences, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PreferencesClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PreferencesList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PreferencesClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PreferencesList, error) {
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

func (c *PreferencesClient) Create(ctx context.Context, obj *Preferences, opts resource.CreateOptions) (*Preferences, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PreferencesKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PreferencesClient) Update(ctx context.Context, obj *Preferences, opts resource.UpdateOptions) (*Preferences, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PreferencesClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Preferences, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PreferencesClient) UpdateStatus(ctx context.Context, newStatus PreferencesStatus, opts resource.UpdateOptions) (*Preferences, error) {
	return c.client.Update(ctx, &Preferences{
		TypeMeta: metav1.TypeMeta{
			Kind:       PreferencesKind().Kind(),
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

func (c *PreferencesClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

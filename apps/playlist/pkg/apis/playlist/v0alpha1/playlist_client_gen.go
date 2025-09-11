package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PlaylistClient struct {
	client *resource.TypedClient[*Playlist, *PlaylistList]
}

func NewPlaylistClient(client resource.Client) *PlaylistClient {
	return &PlaylistClient{
		client: resource.NewTypedClient[*Playlist, *PlaylistList](client, PlaylistKind()),
	}
}

func NewPlaylistClientFromGenerator(generator resource.ClientGenerator) (*PlaylistClient, error) {
	c, err := generator.ClientFor(PlaylistKind())
	if err != nil {
		return nil, err
	}
	return NewPlaylistClient(c), nil
}

func (c *PlaylistClient) Get(ctx context.Context, identifier resource.Identifier) (*Playlist, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PlaylistClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PlaylistList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PlaylistClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PlaylistList, error) {
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

func (c *PlaylistClient) Create(ctx context.Context, obj *Playlist, opts resource.CreateOptions) (*Playlist, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PlaylistKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PlaylistClient) Update(ctx context.Context, obj *Playlist, opts resource.UpdateOptions) (*Playlist, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PlaylistClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Playlist, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PlaylistClient) UpdateStatus(ctx context.Context, newStatus PlaylistStatus, opts resource.UpdateOptions) (*Playlist, error) {
	return c.client.Update(ctx, &Playlist{
		TypeMeta: metav1.TypeMeta{
			Kind:       PlaylistKind().Kind(),
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

func (c *PlaylistClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

package v1

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ rest.Scoper = (*Handler)(nil)
var _ rest.SingularNameProvider = (*Handler)(nil)
var _ rest.Getter = (*Handler)(nil)
var _ rest.Lister = (*Handler)(nil)
var _ rest.Storage = (*Handler)(nil)

type Handler struct{}

func (r *Handler) New() runtime.Object {
	return &Playlist{}
}

func (r *Handler) Destroy() {}

func (r *Handler) NamespaceScoped() bool {
	return true
}

func (r *Handler) GetSingularName() string {
	return "playlist"
}

func (r *Handler) NewList() runtime.Object {
	return &PlaylistList{}
}

func (r *Handler) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(Resource("playlists")).ConvertToTable(ctx, object, tableOptions)
}

func (r *Handler) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: replace
	return &PlaylistList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "PlaylistList",
			APIVersion: "playlist.grafana.io/v1",
		},
		Items: []Playlist{
			{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Playlist",
					APIVersion: "playlist.grafana.io/v1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
				Name: "test",
			},
		},
	}, nil
}

func (r *Handler) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	// TODO: replace
	return &Playlist{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Playlist",
			APIVersion: "playlist.grafana.io/v1",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Name: "test",
	}, nil
}

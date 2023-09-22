package v1

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apis"
	"github.com/grafana/grafana/pkg/services/playlist"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ rest.Scoper = (*handler)(nil)
var _ rest.SingularNameProvider = (*handler)(nil)
var _ rest.Getter = (*handler)(nil)
var _ rest.Lister = (*handler)(nil)
var _ rest.Storage = (*handler)(nil)

type handler struct {
	service playlist.Service
}

func (r *handler) New() runtime.Object {
	return &Playlist{}
}

func (r *handler) Destroy() {}

func (r *handler) NamespaceScoped() bool {
	return true // namespace == org
}

func (r *handler) GetSingularName() string {
	return "playlist"
}

func (r *handler) NewList() runtime.Object {
	return &PlaylistList{}
}

func (r *handler) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(Resource("playlists")).ConvertToTable(ctx, object, tableOptions)
}

func (r *handler) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, ok := request.NamespaceFrom(ctx)
	if ok && ns != "" {
		orgId, err := apis.NamespaceToOrgID(ns)
		if err != nil {
			return nil, err
		}
		fmt.Printf("OrgID: %d\n", orgId)
	}

	// TODO: replace
	return &PlaylistList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "PlaylistList",
			APIVersion: APIVersion,
		},
		Items: []Playlist{
			{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Playlist",
					APIVersion: APIVersion,
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
				},
				Name: "test",
			},
		},
	}, nil
}

func (r *handler) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, ok := request.NamespaceFrom(ctx)
	if ok && ns != "" {
		orgId, err := apis.NamespaceToOrgID(ns)
		if err != nil {
			return nil, err
		}
		fmt.Printf("OrgID: %d\n", orgId)
	}

	// TODO: replace
	return &Playlist{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Playlist",
			APIVersion: APIVersion,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Name: "test",
	}, nil
}

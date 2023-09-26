package v1

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/playlist"
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
	if !ok || ns == "" {
		return nil, fmt.Errorf("namespace required")
	}

	orgId, err := grafanaapiserver.NamespaceToOrgID(ns)
	if err != nil {
		return nil, err
	}

	limit := 100
	if options.Limit > 0 {
		limit = int(options.Limit)
	}
	res, err := r.service.Search(ctx, &playlist.GetPlaylistsQuery{
		OrgId: orgId,
		Limit: limit,
	})
	if err != nil {
		return nil, err
	}

	list := &PlaylistList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "PlaylistList",
			APIVersion: APIVersion,
		},
	}
	for _, v := range res {
		p := Playlist{
			TypeMeta: metav1.TypeMeta{
				Kind:       "Playlist",
				APIVersion: APIVersion,
			},
			ObjectMeta: metav1.ObjectMeta{
				Name: v.UID,
			},
		}
		p.Name = v.Name + " // " + v.Interval
		list.Items = append(list.Items, p)
		// TODO?? if table... we don't need the body of each, otherwise full lookup!
	}
	if len(list.Items) == limit {
		list.Continue = "<more>" // TODO?
	}
	return list, nil
}

func (r *handler) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, ok := request.NamespaceFrom(ctx)
	if !ok || ns == "" {
		return nil, fmt.Errorf("namespace required")
	}

	orgId, err := grafanaapiserver.NamespaceToOrgID(ns)
	if err != nil {
		return nil, err
	}

	p, err := r.service.Get(ctx, &playlist.GetPlaylistByUidQuery{
		UID:   name,
		OrgId: orgId,
	})
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("not found?")
	}

	return &Playlist{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Playlist",
			APIVersion: APIVersion,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: p.Uid,
		},
		Name: p.Name + "//" + p.Interval,
	}, nil
}

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

var (
	_ rest.Scoper               = (*sqlStorage)(nil)
	_ rest.SingularNameProvider = (*sqlStorage)(nil)
	_ rest.Getter               = (*sqlStorage)(nil)
	_ rest.Lister               = (*sqlStorage)(nil)
	_ rest.Storage              = (*sqlStorage)(nil)
)

type sqlStorage struct {
	service playlist.Service
}

func newSQLStorage(s playlist.Service) *sqlStorage {
	return &sqlStorage{
		service: s,
	}
}

func (s *sqlStorage) New() runtime.Object {
	return &Playlist{}
}

func (s *sqlStorage) Destroy() {}

func (s *sqlStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *sqlStorage) GetSingularName() string {
	return "playlist"
}

func (s *sqlStorage) NewList() runtime.Object {
	return &PlaylistList{}
}

func (s *sqlStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(Resource("playlists")).ConvertToTable(ctx, object, tableOptions)
}

func (s *sqlStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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
	res, err := s.service.Search(ctx, &playlist.GetPlaylistsQuery{
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

func (s *sqlStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, ok := request.NamespaceFrom(ctx)
	if !ok || ns == "" {
		return nil, fmt.Errorf("namespace required")
	}

	orgId, err := grafanaapiserver.NamespaceToOrgID(ns)
	if err != nil {
		return nil, err
	}

	p, err := s.service.Get(ctx, &playlist.GetPlaylistByUidQuery{
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

// TODO: implement these
// func (s *sqlStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
// 	// TODO: implement
// 	return nil, nil
// }
//
// func (s *sqlStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
// 	// TODO: implement
// 	return nil, false, nil
// }
//
// func (s *sqlStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
// 	// TODO: implement
// 	return nil, false, nil
// }
//
// func (s *sqlStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
// 	// TODO: implement
// 	return nil, nil
// }

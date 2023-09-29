package v0alpha1

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/kinds/playlist"
	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service playlistsvc.Service
}

func newLegacyStorage(s playlistsvc.Service) *legacyStorage {
	return &legacyStorage{
		service: s,
	}
}

func (s *legacyStorage) New() runtime.Object {
	return &playlist.Playlist{}
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return "playlist"
}

func (s *legacyStorage) NewList() runtime.Object {
	return &playlist.PlaylistList{}
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(Resource("playlists")).ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: handle fetching all available orgs when no namespace is specified
	// To test: kubectl get playlists --all-namespaces
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing orgId")
	}

	limit := 100
	if options.Limit > 0 {
		limit = int(options.Limit)
	}
	res, err := s.service.Search(ctx, &playlistsvc.GetPlaylistsQuery{
		OrgId: orgId,
		Limit: limit,
	})
	if err != nil {
		return nil, err
	}

	list := &playlist.PlaylistList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "PlaylistList",
			APIVersion: playlist.APIVersion,
		},
	}
	for _, v := range res {
		p := playlistsvc.ConvertToK8sResource(v, nil)
		if true { // Only if not table view
			p, err = s.service.Get(ctx, &playlistsvc.GetPlaylistByUidQuery{
				UID:   v.UID,
				OrgId: orgId,
			})
			if err != nil {
				return nil, err
			}
		}
		list.Items = append(list.Items, *p)
	}
	if len(list.Items) == limit {
		list.Continue = "<more>" // TODO?
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing orgId")
	}

	return s.service.Get(ctx, &playlistsvc.GetPlaylistByUidQuery{
		UID:   name,
		OrgId: orgId,
	})
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {

	// TODO!!!!
	return s.Get(ctx, "xx", nil)
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	created := false
	current, err := s.Get(ctx, name, nil)
	if err != nil {
		return current, created, err
	}
	// TODO... actually update
	return current, created, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		return nil, true, fmt.Errorf("missing orgId")
	}

	err := s.service.Delete(ctx, &playlistsvc.DeletePlaylistCommand{
		UID:   name,
		OrgId: orgId,
	})

	return nil, true, err // true is instant delete
}

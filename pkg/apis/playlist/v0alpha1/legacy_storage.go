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
		// TODO??? if admin?  change query to list all tenants?
		orgId = 1
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
		// TODO??? if admin?  change query to list all tenants?
		orgId = 1
	}

	return s.service.Get(ctx, &playlistsvc.GetPlaylistByUidQuery{
		UID:   name,
		OrgId: orgId, // required
	})
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		// TODO??? if admin?  change query to list all tenants?
		orgId = 1
	}

	p, ok := obj.(*playlist.Playlist)
	if !ok {
		return nil, fmt.Errorf("expected playlist?")
	}
	if p.Name != "" {
		return nil, fmt.Errorf("playlist only supports generated names right now")
	}
	if p.GenerateName == "" {
		return nil, fmt.Errorf("generate name must be set")
	}

	spec := p.Spec
	cmd := &playlistsvc.CreatePlaylistCommand{
		Name:     spec.Name,
		Interval: spec.Interval,
		OrgId:    orgId,
	}
	for _, item := range spec.Items {
		if item.Type == playlist.ItemTypeDashboardById {
			return nil, fmt.Errorf("unsupported item type: %s", item.Type)
		}

		cmd.Items = append(cmd.Items, playlistsvc.PlaylistItem{
			Type:  string(item.Type),
			Value: item.Value,
		})
	}
	out, err := s.service.Create(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, out.UID, nil)
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		// TODO??? if admin?  change query to list all tenants?
		orgId = 1
	}

	created := false
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, created, err
	}

	fmt.Printf("OLD: %+v\n", old)

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, created, err
	}
	p, ok := obj.(*playlist.Playlist)
	if !ok {
		fmt.Printf("Expected playlist: %+v\n", obj)

		return nil, created, fmt.Errorf("expected playlist after update")
	}

	fmt.Printf("NEW: %+v\n", obj)

	spec := p.Spec
	cmd := &playlistsvc.UpdatePlaylistCommand{
		UID:      name,
		Name:     spec.Name,
		Interval: spec.Interval,
		OrgId:    orgId,
	}
	for _, item := range spec.Items {
		if item.Type == playlist.ItemTypeDashboardById {
			return nil, false, fmt.Errorf("unsupported item type: %s", item.Type)
		}
		cmd.Items = append(cmd.Items, playlistsvc.PlaylistItem{
			Type:  string(item.Type),
			Value: item.Value,
		})
	}

	_, err = s.service.Update(ctx, cmd)
	if err != nil {
		return nil, false, err
	}

	r, err := s.Get(ctx, name, nil)
	return r, created, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		// TODO??? if admin?  change query to list all tenants?
		orgId = 1
	}

	err := s.service.Delete(ctx, &playlistsvc.DeletePlaylistCommand{
		UID:   name,
		OrgId: orgId,
	})

	return nil, true, err // true is instant delete
}

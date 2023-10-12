package v0alpha1

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/playlist"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service    playlist.Service
	namespacer namespaceMapper
}

func (s *legacyStorage) New() runtime.Object {
	return &Playlist{}
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return "playlist"
}

func (s *legacyStorage) NewList() runtime.Object {
	return &PlaylistList{}
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(Resource("playlists")).ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: handle fetching all available orgs when no namespace is specified
	// To test: kubectl get playlists --all-namespaces
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	limit := 100
	if options.Limit > 0 {
		limit = int(options.Limit)
	}
	res, err := s.service.Search(ctx, &playlist.GetPlaylistsQuery{
		OrgId: info.OrgID,
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
		p, err := s.service.Get(ctx, &playlist.GetPlaylistByUidQuery{
			UID:   v.UID,
			OrgId: info.OrgID,
		})
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, *convertToK8sResource(p, s.namespacer))
	}
	if len(list.Items) == limit {
		list.Continue = "<more>" // TODO?
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dto, err := s.service.Get(ctx, &playlist.GetPlaylistByUidQuery{
		UID:   name,
		OrgId: info.OrgID,
	})
	if err != nil {
		return nil, err
	}
	if dto == nil {
		return nil, fmt.Errorf("not found?")
	}

	return convertToK8sResource(dto, s.namespacer), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	p, ok := obj.(*Playlist)
	if !ok {
		return nil, fmt.Errorf("expected playlist?")
	}
	spec := p.Spec
	cmd := &playlist.CreatePlaylistCommand{
		Name:     spec.Title,
		Interval: spec.Interval,
		OrgId:    info.OrgID,
	}
	if p.Name != "" {
		cmd.UID = p.Name
	}
	for _, item := range spec.Items {
		if item.Type == ItemTypeDashboardById {
			return nil, fmt.Errorf("unsupported item type: %s", item.Type)
		}
		cmd.Items = append(cmd.Items, playlist.PlaylistItem{
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
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	created := false
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, created, err
	}

	fmt.Printf("Update OLD: %+v\n", old)

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, created, err
	}
	p, ok := obj.(*Playlist)
	if !ok {
		fmt.Printf("Expected playlist: %+v\n", obj)

		return nil, created, fmt.Errorf("expected playlist after update")
	}

	fmt.Printf("NEW: %+v\n", obj)

	spec := p.Spec
	cmd := &playlist.UpdatePlaylistCommand{
		UID:      name,
		Name:     spec.Title,
		Interval: spec.Interval,
		OrgId:    info.OrgID,
	}
	for _, item := range spec.Items {
		if item.Type == ItemTypeDashboardById {
			return nil, false, fmt.Errorf("unsupported item type: %s", item.Type)
		}
		cmd.Items = append(cmd.Items, playlist.PlaylistItem{
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
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	err = s.service.Delete(ctx, &playlist.DeletePlaylistCommand{
		UID:   name,
		OrgId: info.OrgID,
	})
	return nil, true, err // true is instant delete
}

package playlist

import (
	"context"
	"errors"
	"fmt"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
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
	service        playlistsvc.Service
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
	gvk            schema.GroupVersionKind
}

func (s *legacyStorage) getGVK() schema.GroupVersionKind {
	return s.gvk
}

func (s *legacyStorage) New() runtime.Object {
	// return the appropriate versioned Kind (v0alpha1 and v1 are aliases, but have different metadata)
	if s.getGVK().Version == "v1" {
		return playlistv1.PlaylistKind().ZeroValue()
	}
	return playlistv0alpha1.PlaylistKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(playlistv1.PlaylistKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	// return the appropriate versioned Kind (v0alpha1 and v1 are aliases, but have different metadata)
	if s.getGVK().Version == "v1" {
		return playlistv1.PlaylistKind().ZeroListValue()
	}
	return playlistv0alpha1.PlaylistKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	res, err := s.service.List(ctx, orgId)
	if err != nil {
		return nil, err
	}

	// v0alpha1 and v1 are aliases, so we can use a single type for list construction,
	// the version metadata is set in each object by convertToK8sResourceWithVersion
	list := &playlistv1.PlaylistList{}
	for idx := range res {
		obj := convertToK8sResourceWithVersion(&res[idx], s.namespacer, s.getGVK())
		if p, ok := obj.(*playlistv1.Playlist); ok {
			list.Items = append(list.Items, *p)
		}
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dto, err := s.service.Get(ctx, &playlistsvc.GetPlaylistByUidQuery{
		UID:   name,
		OrgId: info.OrgID,
	})
	if err != nil || dto == nil {
		if errors.Is(err, playlistsvc.ErrPlaylistNotFound) || err == nil {
			gvk := s.getGVK()
			gr := schema.GroupResource{Group: gvk.Group, Resource: "playlists"}
			err = k8serrors.NewNotFound(gr, name)
		}
		return nil, err
	}

	return convertToK8sResourceWithVersion(dto, s.namespacer, s.getGVK()), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	// v0alpha1 and v1 are aliases, we can just use v1
	p, ok := obj.(*playlistv1.Playlist)
	if !ok {
		return nil, fmt.Errorf("expected playlist, got %T", obj)
	}
	name := p.Name

	cmd, err := convertToLegacyUpdateCommand(obj, info.OrgID)
	if err != nil {
		return nil, err
	}
	out, err := s.service.Create(ctx, &playlistsvc.CreatePlaylistCommand{
		UID:      name,
		Name:     cmd.Name,
		Interval: cmd.Interval,
		Items:    cmd.Items,
		OrgId:    cmd.OrgId,
	})
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
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	created := false
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, created, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, created, err
	}

	cmd, err := convertToLegacyUpdateCommand(obj, info.OrgID)
	if err != nil {
		return old, created, err
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
	v, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return v, false, err // includes the not-found error
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	err = s.service.Delete(ctx, &playlistsvc.DeletePlaylistCommand{
		UID:   name,
		OrgId: info.OrgID,
	})
	return v, true, err // true is instant delete
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for playlists not implemented")
}

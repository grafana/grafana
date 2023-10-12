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
)

type legacyStorage struct {
	service playlist.Service
}

func newLegacyStorage(s playlist.Service) *legacyStorage {
	return &legacyStorage{
		service: s,
	}
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
	p, ok := object.(*PlaylistList)
	if ok {
		t := &metav1.Table{
			TypeMeta: metav1.TypeMeta{
				Kind:       "Table",
				APIVersion: "meta.k8s.io/v1",
			},
			ColumnDefinitions: []metav1.TableColumnDefinition{{
				Name:        "Name",
				Type:        "string",
				Format:      "name",
				Description: "Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names",
				Priority:    0,
			}, {
				Name:        "Title",
				Type:        "string",
				Format:      "string",
				Description: "The playlist display name",
				Priority:    0,
			}, {
				Name:        "Interval",
				Type:        "string",
				Format:      "string",
				Description: "Refresh interval",
				Priority:    0,
			}},
		}

		for _, v := range p.Items {
			t.Rows = append(t.Rows, metav1.TableRow{
				Cells: []interface{}{
					v.Name,
					v.Spec.Title,
					v.Spec.Interval,
				},
				Object: runtime.RawExtension{
					Object: &v,
				},
			})
		}
		return t, nil
	}

	// It may already be a table
	t, ok := object.(*metav1.Table)
	if ok {
		return t, nil
	}

	// Fallback to the default converter
	return rest.NewDefaultTableConvertor(Resource("playlists")).
		ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: handle fetching all available orgs when no namespace is specified
	// To test: kubectl get playlists --all-namespaces
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		orgId = 1 // TODO: default org ID 1 for now
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
	if true { // table can skip query for each item
		for _, v := range res {
			list.Items = append(list.Items,
				*convertPlaylistToK8sResource(v, orgNamespaceMapper),
			)
		}
	} else {
		// We must query for all nested items
		for _, v := range res {
			p, err := s.service.Get(ctx, &playlist.GetPlaylistByUidQuery{
				UID:   v.UID,
				OrgId: orgId, // required
			})
			if err != nil {
				return nil, err
			}
			list.Items = append(list.Items,
				*convertPlaylistToK8sResource(p, orgNamespaceMapper),
			)
		}
	}

	if len(list.Items) == limit {
		list.Continue = "<more>" // TODO?
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		orgId = 1 // TODO: default org ID 1 for now
	}

	dto, err := s.service.Get(ctx, &playlist.GetPlaylistByUidQuery{
		UID:   name,
		OrgId: orgId,
	})
	if err != nil {
		return nil, err
	}
	if dto == nil {
		return nil, fmt.Errorf("not found?")
	}

	return convertToK8sResource(dto, orgNamespaceMapper), nil
}

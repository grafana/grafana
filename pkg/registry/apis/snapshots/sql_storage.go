package snapshots

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	snapshots "github.com/grafana/grafana/pkg/apis/snapshots/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/util"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        dashboardsnapshots.Service
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor

	DefaultQualifiedResource  schema.GroupResource
	SingularQualifiedResource schema.GroupResource
}

func (s *legacyStorage) New() runtime.Object {
	return &snapshots.DashboardSnapshot{}
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return "dashboard"
}

func (s *legacyStorage) NewList() runtime.Object {
	return &snapshots.DashboardSnapshotList{}
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: handle fetching all available orgs when no namespace is specified
	// To test: kubectl get playlists --all-namespaces
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	limit := 100
	if options.Limit > 0 {
		limit = int(options.Limit)
	}
	res, err := s.service.SearchDashboardSnapshots(ctx, &dashboardsnapshots.GetDashboardSnapshotsQuery{
		OrgID:        info.OrgID,
		SignedInUser: user,
	})
	if err != nil {
		return nil, err
	}

	list := &snapshots.DashboardSnapshotList{}
	for _, v := range res {
		list.Items = append(list.Items, *convertDTOToSummary(v, s.namespacer))
	}
	if len(list.Items) == limit {
		list.Continue = "<more>" // TODO?
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	v, err := s.service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	})
	if err != nil || v == nil {
		// if errors.Is(err, playlistsvc.ErrPlaylistNotFound) || err == nil {
		// 	err = k8serrors.NewNotFound(s.SingularQualifiedResource, name)
		// }
		return nil, err
	}

	return convertSnapshotToK8sResource(v, s.namespacer), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	snap, ok := obj.(*snapshots.DashboardSnapshot)
	if !ok {
		return nil, fmt.Errorf("expected playlist?")
	}
	if snap.Name == "" {
		snap.Name = util.GenerateShortUID()
	}
	if snap.DeleteKey == "" {
		snap.DeleteKey = util.GenerateShortUID()
	}
	out, err := s.service.CreateDashboardSnapshot(ctx, &dashboardsnapshots.CreateDashboardSnapshotCommand{
		// TODO
	})
	if err != nil {
		return nil, err
	}

	// TODO, copy more?
	snap.DeleteKey = out.DeleteKey
	return snap, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// v, err := s.Get(ctx, name, &metav1.GetOptions{})
	// if err != nil {
	// 	return v, false, err // includes the not-found error
	// }
	// info, err := request.NamespaceInfoFrom(ctx, true)
	// if err != nil {
	// 	return nil, false, err
	// }
	// p, ok := v.(*playlist.Playlist)
	// if !ok {
	// 	return v, false, fmt.Errorf("expected a playlist response from Get")
	// }
	// err = s.service.Delete(ctx, &playlistsvc.DeletePlaylistCommand{
	// 	UID:   name,
	// 	OrgId: info.OrgID,
	// })
	//return p, true, err // true is instant delete
	return nil, false, fmt.Errorf("not implemented yet")
}

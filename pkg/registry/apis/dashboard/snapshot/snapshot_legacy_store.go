package snapshot

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/utils/ptr"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

var (
	_ rest.Scoper               = (*SnapshotLegacyStore)(nil)
	_ rest.SingularNameProvider = (*SnapshotLegacyStore)(nil)
	_ rest.Getter               = (*SnapshotLegacyStore)(nil)
	_ rest.Lister               = (*SnapshotLegacyStore)(nil)
	_ rest.Creater              = (*SnapshotLegacyStore)(nil)
	_ rest.GracefulDeleter      = (*SnapshotLegacyStore)(nil)
	_ rest.Storage              = (*SnapshotLegacyStore)(nil)
)

type SnapshotLegacyStore struct {
	ResourceInfo utils.ResourceInfo
	Service      dashboardsnapshots.Service
	Namespacer   request.NamespaceMapper
	Options      SharingOptionGetter
}

func (s *SnapshotLegacyStore) New() runtime.Object {
	return s.ResourceInfo.NewFunc()
}

func (s *SnapshotLegacyStore) Destroy() {}

func (s *SnapshotLegacyStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *SnapshotLegacyStore) GetSingularName() string {
	return s.ResourceInfo.GetSingularName()
}

func (s *SnapshotLegacyStore) NewList() runtime.Object {
	return s.ResourceInfo.NewListFunc()
}

func (s *SnapshotLegacyStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.ResourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

// Create is not supported for snapshots - use the /snapshots/create custom endpoint instead
func (s *SnapshotLegacyStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	snap, ok := obj.(*dashV0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected snapshot input")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	cmd := &dashboardsnapshots.CreateDashboardSnapshotCommand{
		DashboardCreateCommand: dashV0.DashboardCreateCommand{
			Name:     snap.Name,
			Expires:  ptr.Deref(snap.Spec.Expires, 0),
			External: ptr.Deref(snap.Spec.External, false),
			Dashboard: &v0alpha1.Unstructured{
				Object: snap.Spec.Dashboard,
			},
		},
		OrgID: ns.OrgID,
	}
	created, err := s.Service.CreateDashboardSnapshot(ctx, cmd)
	if err != nil {
		return nil, err
	}
	obj = convertSnapshotToK8sResource(created, s.Namespacer)
	return obj, nil
}

// GracefulDeleter
func (s *SnapshotLegacyStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	snap, err := s.Service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	})
	if err != nil || snap == nil {
		return nil, false, err
	}

	// Delete the external one first
	if snap.ExternalDeleteURL != "" {
		err := dashboardsnapshots.DeleteExternalDashboardSnapshot(snap.ExternalDeleteURL)
		if err != nil {
			return nil, false, err
		}
	}

	err = s.Service.DeleteDashboardSnapshot(ctx, &dashboardsnapshots.DeleteDashboardSnapshotCommand{
		DeleteKey: snap.DeleteKey,
	})
	if err != nil {
		return nil, false, err
	}
	return nil, true, nil
}

func (s *SnapshotLegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	limit := options.Limit
	if limit < 1 {
		limit = 1000
	}

	searchQuery := dashboardsnapshots.GetDashboardSnapshotsQuery{
		Name:         "", // TODO: Should we support searching by name? In the levacy api is a string query param called query
		Limit:        int(limit),
		OrgID:        orgId,
		SignedInUser: requester,
	}

	res, err := s.Service.SearchDashboardSnapshots(ctx, &searchQuery)
	if err != nil {
		return nil, err
	}

	list := &dashV0.SnapshotList{}
	//convert
	for idx := range res {
		list.Items = append(list.Items, *convertSnapshotDTOToK8sResource(res[idx], s.Namespacer))
	}
	return list, nil
}

func (s *SnapshotLegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	err = s.checkEnabled(info.Value)
	if err != nil {
		return nil, err
	}
	query := dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	}

	res, err := s.Service.GetDashboardSnapshot(ctx, &query)
	if err != nil {
		return nil, err
	}

	if res != nil {
		return convertSnapshotToK8sResource(res, s.Namespacer), nil
	}
	return nil, s.ResourceInfo.NewNotFound(name)
}

func (s *SnapshotLegacyStore) checkEnabled(ns string) error {
	opts, err := s.Options(ns)
	if err != nil {
		return err
	}
	if !*opts.Spec.SnapshotsEnabled {
		return fmt.Errorf("snapshots not enabled")
	}
	return nil
}

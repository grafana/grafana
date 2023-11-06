package snapshots

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	snapshots "github.com/grafana/grafana/pkg/apis/snapshots/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

var (
	_ rest.Scoper          = (*deleteKeyStorage)(nil)
	_ rest.GracefulDeleter = (*deleteKeyStorage)(nil)
)

type deleteKeyStorage struct {
	service        dashboardsnapshots.Service
	tableConverter rest.TableConvertor
}

func (s *deleteKeyStorage) New() runtime.Object {
	return &snapshots.DashboardSnapshot{}
}

func (s *deleteKeyStorage) Destroy() {}

func (s *deleteKeyStorage) NamespaceScoped() bool {
	return false
}

func (s *deleteKeyStorage) GetSingularName() string {
	return "dashboardDeleteKey"
}

func (s *deleteKeyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// GracefulDeleter
func (s *deleteKeyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	err := s.service.DeleteDashboardSnapshot(ctx, &dashboardsnapshots.DeleteDashboardSnapshotCommand{
		DeleteKey: name, // anyone that knows the key can delete it!
	})
	return nil, true, err
}

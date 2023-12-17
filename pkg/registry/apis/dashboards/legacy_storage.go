package dashboards

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

var (
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	// _ rest.Creater              = (*legacyStorage)(nil)
	// _ rest.Updater              = (*legacyStorage)(nil)
	// _ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	store      *genericregistry.Store
	builder    *DashboardsAPIBuilder
	namespacer request.NamespaceMapper
}

func (s *legacyStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true
}

func (s *legacyStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	maxCount := int(options.Limit)
	if maxCount < 1 {
		maxCount = 1000
	}
	maxBytes := int64(2 * 1024 * 1024) // 2MB
	totalSize := int64(0)
	list := &dashboards.DashboardList{}
	rows, err := s.builder.access.GetDashboards(ctx, orgId, options.Continue)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	for {
		row, err := rows.Next()
		if err != nil || row == nil {
			return list, err
		}

		// TODO: check if we have permissions to see this item

		totalSize += int64(row.Bytes)
		if len(list.Items) > 0 && (totalSize > maxBytes || len(list.Items) >= maxCount) {
			list.Continue = row.ContinueToken // will skip this one but start here next time
			return list, err
		}
		list.Items = append(list.Items, *row.Dash)
	}
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return s.builder.access.GetDashboard(ctx, info.OrgID, name)
}

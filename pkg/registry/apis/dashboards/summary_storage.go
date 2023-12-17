package dashboards

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis"
	"github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboards/access"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

var (
	_ rest.Storage              = (*summaryStorage)(nil)
	_ rest.Scoper               = (*summaryStorage)(nil)
	_ rest.SingularNameProvider = (*summaryStorage)(nil)
	_ rest.Getter               = (*summaryStorage)(nil)
	_ rest.Lister               = (*summaryStorage)(nil)
)

type summaryStorage struct {
	resource       apis.ResourceInfo
	access         access.DashboardAccess
	tableConverter rest.TableConvertor
}

func (s *summaryStorage) New() runtime.Object {
	return s.resource.NewFunc()
}

func (s *summaryStorage) Destroy() {}

func (s *summaryStorage) NamespaceScoped() bool {
	return true
}

func (s *summaryStorage) GetSingularName() string {
	return s.resource.GetSingularName()
}

func (s *summaryStorage) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

func (s *summaryStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *summaryStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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
	list := &v0alpha1.DashboardSummaryList{}
	rows, err := s.access.GetDashboards(ctx, orgId, options.Continue, true)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	for {
		row, err := rows.Next()
		if err != nil || row == nil {
			return list, err
		}

		totalSize += int64(row.Bytes)
		if len(list.Items) > 0 && (totalSize > maxBytes || len(list.Items) >= maxCount) {
			list.Continue = row.ContinueToken // will skip this one but start here next time
			return list, err
		}

		summary, _ := toSummary(row, err)
		list.Items = append(list.Items, *summary)
	}
}

func (s *summaryStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return toSummary(s.access.GetDashboard(ctx, info.OrgID, name))
}

func toSummary(row *access.DashboardRow, err error) (*v0alpha1.DashboardSummary, error) {
	if err != nil {
		return nil, err
	}
	return &v0alpha1.DashboardSummary{
		ObjectMeta: row.Dash.ObjectMeta,
		Spec: v0alpha1.DashboardSummarySpec{
			Title: row.Title,
			Tags:  row.Tags,
		},
	}, nil
}

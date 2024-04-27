package dashboard

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/access"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Storage              = (*summaryStorage)(nil)
	_ rest.Scoper               = (*summaryStorage)(nil)
	_ rest.SingularNameProvider = (*summaryStorage)(nil)
	_ rest.Getter               = (*summaryStorage)(nil)
	_ rest.Lister               = (*summaryStorage)(nil)
)

type summaryStorage struct {
	resource       common.ResourceInfo
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

	query := &access.DashboardQuery{
		OrgID:         orgId,
		Limit:         int(options.Limit),
		MaxBytes:      2 * 1024 * 1024, // 2MB,
		ContinueToken: options.Continue,
	}
	return s.access.GetDashboardSummaries(ctx, query)
}

func (s *summaryStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return s.access.GetDashboardSummary(ctx, info.OrgID, name)
}

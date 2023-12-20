package dashboards

import (
	"context"
	"fmt"
	"strings"
	"time"

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
	_ rest.Storage              = (*dashboardStorage)(nil)
	_ rest.Scoper               = (*dashboardStorage)(nil)
	_ rest.SingularNameProvider = (*dashboardStorage)(nil)
	_ rest.Getter               = (*dashboardStorage)(nil)
	_ rest.Lister               = (*dashboardStorage)(nil)
	_ rest.Creater              = (*dashboardStorage)(nil)
	_ rest.Updater              = (*dashboardStorage)(nil)
	_ rest.GracefulDeleter      = (*dashboardStorage)(nil)
)

type dashboardStorage struct {
	resource       apis.ResourceInfo
	access         access.DashboardAccess
	tableConverter rest.TableConvertor
}

func (s *dashboardStorage) New() runtime.Object {
	return s.resource.NewFunc()
}

func (s *dashboardStorage) Destroy() {}

func (s *dashboardStorage) NamespaceScoped() bool {
	return true
}

func (s *dashboardStorage) GetSingularName() string {
	return s.resource.GetSingularName()
}

func (s *dashboardStorage) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

func (s *dashboardStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *dashboardStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	p, ok := obj.(*v0alpha1.Dashboard)
	if !ok {
		return nil, fmt.Errorf("expected dashboard?")
	}

	// HACK to simplify unique name testing from kubectl
	t := p.Spec.GetNestedString("title")
	if strings.Contains(t, "${NOW}") {
		t = strings.ReplaceAll(t, "${NOW}", fmt.Sprintf("%d", time.Now().Unix()))
		p.Spec.Set("title", t)
	}

	uid, _, err := s.access.SaveDashboard(ctx, info.OrgID, p)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, uid, nil)
}

func (s *dashboardStorage) Update(ctx context.Context,
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
	p, ok := obj.(*v0alpha1.Dashboard)
	if !ok {
		return nil, created, fmt.Errorf("expected dashboard after update")
	}

	_, created, err = s.access.SaveDashboard(ctx, info.OrgID, p)
	if err == nil {
		r, err := s.Get(ctx, name, nil)
		return r, created, err
	}
	return nil, created, err
}

// GracefulDeleter
func (s *dashboardStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	return s.access.DeleteDashboard(ctx, info.OrgID, name)
}

func (s *dashboardStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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
	list := &v0alpha1.DashboardList{}
	rows, err := s.access.GetDashboards(ctx, orgId, options.Continue, false)
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
		list.Items = append(list.Items, *row.Dash)
	}
}

func (s *dashboardStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	row, err := s.access.GetDashboard(ctx, info.OrgID, name)
	if err != nil {
		return nil, err
	}
	return row.Dash, nil
}

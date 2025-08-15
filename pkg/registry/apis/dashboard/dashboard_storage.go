package dashboard

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*dashboardStorage)(nil)
	_ rest.SingularNameProvider = (*dashboardStorage)(nil)
	_ rest.Getter               = (*dashboardStorage)(nil)
	_ rest.Lister               = (*dashboardStorage)(nil)
	_ rest.Storage              = (*dashboardStorage)(nil)
	_ rest.Creater              = (*dashboardStorage)(nil)
	_ rest.Updater              = (*dashboardStorage)(nil)
	_ rest.GracefulDeleter      = (*dashboardStorage)(nil)
)

// dashboardStorage is a wrapper around the grafanarest.Storage that adds dashboard permissions handling
// when dual writing is enabled.
type dashboardStorage struct {
	dashboardPermissionsSvc accesscontrol.DashboardPermissionsService
	store                   grafanarest.Storage
}

func (d dashboardStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	obj, async, err := d.store.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		return obj, async, err
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return obj, async, err
	}
	if accessErr := d.dashboardPermissionsSvc.DeleteResourcePermissions(ctx, info.OrgID, name); accessErr != nil {
		return obj, async, accessErr
	}
	return obj, async, nil
}

func (d dashboardStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return d.store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func (d dashboardStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return d.store.Create(ctx, obj, createValidation, options)
}

func (d dashboardStorage) New() runtime.Object {
	return d.store.New()
}

func (d dashboardStorage) Destroy() {
	d.store.Destroy()
}

func (d dashboardStorage) NewList() runtime.Object {
	return d.store.NewList()
}

func (d dashboardStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return d.store.List(ctx, options)
}

func (d dashboardStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.store.ConvertToTable(ctx, object, tableOptions)
}

func (d dashboardStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return d.store.Get(ctx, name, options)
}

func (d dashboardStorage) GetSingularName() string {
	return d.store.GetSingularName()
}

func (d dashboardStorage) NamespaceScoped() bool {
	return d.store.NamespaceScoped()
}

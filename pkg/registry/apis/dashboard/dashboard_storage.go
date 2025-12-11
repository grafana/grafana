package dashboard

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/live"
)

// dashboardStorageWrapper is a wrapper around the grafanarest.Storage so it will:
// 1. support adds dashboard permissions handling
// 2. broadcast changes to grafana live
// when running in single tenant mode
type dashboardStorageWrapper struct {
	grafanarest.Storage

	dashboardPermissionsSvc accesscontrol.DashboardPermissionsService
	live                    live.DashboardActivityChannel
}

func (d dashboardStorageWrapper) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	obj, created, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err == nil && ns.OrgID > 0 && d.live != nil {
		if err := d.live.DashboardSaved(ns.OrgID, name); err != nil {
			logging.FromContext(ctx).Info("live dashboard update failed", "err", err)
		}
	}
	return obj, created, err
}

func (d dashboardStorageWrapper) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	obj, async, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		return obj, async, err
	}
	if ns.OrgID > 0 && d.live != nil {
		if err := d.live.DashboardDeleted(ns.OrgID, name); err != nil {
			logging.FromContext(ctx).Info("live dashboard update failed", "err", err)
		}
	}
	if accessErr := d.dashboardPermissionsSvc.DeleteResourcePermissions(ctx, ns.OrgID, name); accessErr != nil {
		return obj, async, accessErr
	}
	return obj, async, nil
}

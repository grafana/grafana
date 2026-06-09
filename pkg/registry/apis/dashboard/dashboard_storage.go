package dashboard

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/warning"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/home"
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

	// Support home dashboards
	homeDashboard home.HomeDashboardGetter
	apiVersion    string

	// Clear the dashboard cache on Delete
	dashboardPermissionsSvc accesscontrol.DashboardPermissionsService

	// Broadcast events
	live live.DashboardActivityChannel
}

func (d dashboardStorageWrapper) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	tracker := &folderChangeTracker{inner: objInfo}

	obj, created, err := d.Storage.Update(ctx, name, tracker, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return obj, created, err
	}

	if ns.OrgID > 0 && d.live != nil {
		m, err := utils.MetaAccessor(obj)
		if err == nil {
			if err := d.live.DashboardSaved(ns.Value, name, m.GetResourceVersion()); err != nil {
				logging.FromContext(ctx).Info("live dashboard update failed", "err", err)
			}
		}
	}

	// Clear direct grants on move so principals don't keep access in a more restrictive parent.
	if !created && tracker.folderChanged() && ns.OrgID > 0 && d.dashboardPermissionsSvc != nil {
		if accessErr := d.dashboardPermissionsSvc.DeleteResourcePermissions(ctx, ns.OrgID, name); accessErr != nil {
			return obj, created, accessErr
		}
		warning.AddWarning(ctx, "", fmt.Sprintf("Directly assigned permissions on dashboard %q were cleared because its parent folder changed (from %q to %q). Inherited folder permissions still apply.", name, tracker.oldFolder, tracker.newFolder))
	}

	return obj, created, nil
}

type folderChangeTracker struct {
	inner     rest.UpdatedObjectInfo
	captured  bool
	oldFolder string
	newFolder string
}

func (t *folderChangeTracker) Preconditions() *metav1.Preconditions {
	return t.inner.Preconditions()
}

func (t *folderChangeTracker) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	newObj, err := t.inner.UpdatedObject(ctx, oldObj)
	if err != nil {
		return newObj, err
	}
	if oldMeta, mErr := utils.MetaAccessor(oldObj); mErr == nil {
		t.oldFolder = oldMeta.GetFolder()
	}
	if newMeta, mErr := utils.MetaAccessor(newObj); mErr == nil {
		t.newFolder = newMeta.GetFolder()
	}
	t.captured = true
	return newObj, nil
}

func (t *folderChangeTracker) folderChanged() bool {
	return t.captured && t.oldFolder != t.newFolder
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
		if err := d.live.DashboardDeleted(ns.Value, name); err != nil {
			logging.FromContext(ctx).Info("live dashboard update failed", "err", err)
		}
	}
	if accessErr := d.dashboardPermissionsSvc.DeleteResourcePermissions(ctx, ns.OrgID, name); accessErr != nil {
		return obj, async, accessErr
	}
	return obj, async, nil
}

func (d dashboardStorageWrapper) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	if name == home.DASHBOARD_NAME && d.homeDashboard != nil {
		return d.homeDashboard.Get(d.apiVersion)
	}

	return d.Storage.Get(ctx, name, options)
}

package dashboard

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/home"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

	// Skip the legacy permission deletion when the App Platform path owns permissions
	features featuremgmt.FeatureToggles
}

// Create overrides the embedded Storage's Create so a caller can opt into overwriting
// an existing dashboard of the same name instead of getting AlreadyExists, by setting
// the grafana.app/overwrite-existing annotation. The annotation is always stripped
// before any write is attempted, whether or not the overwrite path ends up firing.
func (d dashboardStorageWrapper) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	overwrite := meta.GetAnnotation(utils.AnnoKeyOverwriteExisting) == "true"
	if overwrite {
		meta.SetAnnotation(utils.AnnoKeyOverwriteExisting, "")
	}
	if !overwrite || !d.features.IsEnabledGlobally(featuremgmt.FlagDashboardOverwriteOnCreate) {
		return d.Storage.Create(ctx, obj, createValidation, options)
	}

	created, err := d.Storage.Create(ctx, obj, createValidation, options)
	if err == nil || !apierrors.IsAlreadyExists(err) {
		return created, err
	}

	name := meta.GetName()
	old, getErr := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if getErr != nil {
		// The original AlreadyExists is the more useful error here; the resource
		// clearly exists even if we can't read it back (e.g. a permission edge case).
		return nil, err
	}
	oldMeta, metaErr := utils.MetaAccessor(old)
	if metaErr != nil {
		return nil, metaErr
	}
	if m, ok := oldMeta.GetManagerProperties(); ok && !m.AllowsEdits {
		return nil, apierrors.NewBadRequest(dashboards.ErrDashboardCannotSaveProvisionedDashboard.Reason)
	}

	updated, _, updateErr := d.Update(
		ctx, name, rest.DefaultUpdatedObjectInfo(obj), createValidation,
		func(ctx context.Context, obj, old runtime.Object) error { return createValidation(ctx, obj) },
		false, &metav1.UpdateOptions{DryRun: options.DryRun, FieldManager: options.FieldManager, FieldValidation: options.FieldValidation},
	)
	return updated, updateErr
}

func (d dashboardStorageWrapper) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	obj, created, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err == nil && ns.OrgID > 0 && d.live != nil {
		m, err := utils.MetaAccessor(obj)
		if err == nil {
			if err := d.live.DashboardSaved(ns.Value, name, m.GetResourceVersion()); err != nil {
				logging.FromContext(ctx).Info("live dashboard update failed", "err", err)
			}
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
		if err := d.live.DashboardDeleted(ns.Value, name); err != nil {
			logging.FromContext(ctx).Info("live dashboard update failed", "err", err)
		}
	}
	// With the flag on, the App Platform path (the store's afterDelete hook) deletes permissions, so
	// skip the legacy deletion here to avoid a double call. Standalone never registers this wrapper.
	if d.features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzResourcePermissionApis) { //nolint:staticcheck
		return obj, async, nil
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

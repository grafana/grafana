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

// stripOverwriteAnnotation wraps an UpdatedObjectInfo so the grafana.app/overwrite-existing
// annotation is never persisted through Update either — a client may keep sending it on
// every apply after an overwrite (e.g. Terraform re-sending unchanged config).
type stripOverwriteAnnotation struct {
	rest.UpdatedObjectInfo
}

func (s stripOverwriteAnnotation) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	obj, err := s.UpdatedObjectInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return obj, err
	}
	if meta, mErr := utils.MetaAccessor(obj); mErr == nil && meta.GetAnnotation(utils.AnnoKeyOverwriteExisting) != "" {
		meta.SetAnnotation(utils.AnnoKeyOverwriteExisting, "")
	}
	return obj, nil
}

// Create overrides the embedded Storage's Create so a caller can opt into overwriting
// an existing dashboard of the same name instead of getting AlreadyExists, by setting
// the grafana.app/overwrite-existing annotation. The annotation is always stripped
// before any write is attempted, whether or not the overwrite path ends up firing.
//
// Existence is checked with a Get rather than attempting Create optimistically: an
// optimistic Create would run CREATE-flavored admission (including the dashboard quota
// check) against an object that already exists, and would require folder-create
// permission even when the caller already has edit rights on the specific dashboard —
// neither of which is the right check for what is really an update. This also matches
// how the legacy /api/dashboards/db endpoint's saveDashboardViaK8s already behaves.
func (d dashboardStorageWrapper) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	raw := meta.GetAnnotation(utils.AnnoKeyOverwriteExisting)
	if raw != "" {
		meta.SetAnnotation(utils.AnnoKeyOverwriteExisting, "")
	}
	overwrite := raw == "true"
	if !overwrite || !d.features.IsEnabledGlobally(featuremgmt.FlagDashboardOverwriteOnCreate) { //nolint:staticcheck
		return d.Storage.Create(ctx, obj, createValidation, options)
	}

	name := meta.GetName()
	old, getErr := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if apierrors.IsNotFound(getErr) {
		return d.Storage.Create(ctx, obj, createValidation, options)
	}
	if getErr != nil {
		return nil, getErr
	}

	oldMeta, metaErr := utils.MetaAccessor(old)
	if metaErr != nil {
		return nil, metaErr
	}
	if m, ok := oldMeta.GetManagerProperties(); ok && !m.AllowsEdits {
		return nil, apierrors.NewBadRequest(dashboards.ErrDashboardCannotSaveProvisionedDashboard.Reason)
	}

	// A client's Create payload normally carries no UID/resourceVersion, but clear them
	// defensively so DefaultUpdatedObjectInfo's precondition check never trips on stale
	// identity — same reset saveDashboardViaK8s does before its own Update call in
	// pkg/api/dashboard.go.
	meta.SetUID("")
	meta.SetResourceVersion("")

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

	obj, created, err := d.Storage.Update(ctx, name, stripOverwriteAnnotation{objInfo}, createValidation, updateValidation, forceAllowCreate, options)
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

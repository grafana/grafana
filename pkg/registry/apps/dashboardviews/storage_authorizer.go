package dashboardviews

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardviewsv0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// GetNamespaceScopedStorageAuthorizer implements appinstaller.NamespaceScopedStorageAuthorizerProvider.
// Without this, the generic storage for a namespace-scoped resource is left unwrapped — GetAuthorizer()
// returning DecisionAllow (register.go) is the only gate, which is no gate at all. This is where the
// real, per-object check lives, because it's the earliest point in the request path that has both the
// object body (for spec.dashboardUID) and the caller's identity.
func (a *AppInstaller) GetNamespaceScopedStorageAuthorizer(_ schema.GroupResource) storewrapper.ResourceStorageAuthorizer {
	return &savedViewStorageAuthorizer{ac: a.ac}
}

// savedViewStorageAuthorizer gates every verb on the same check: the dashboard's existing View
// permission (dashboards:read), scoped to the view's spec.dashboardUID. One action for every verb is
// deliberate — any viewer, not just an editor, can list/apply/save/rename/overwrite/delete a dashboard's
// Saved Views (spec section 2.2).
type savedViewStorageAuthorizer struct {
	ac accesscontrol.AccessControl
}

func (s *savedViewStorageAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return s.checkAccess(ctx, obj)
}

func (s *savedViewStorageAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	// Check both: dashboardUID is meant to be immutable, but nothing below this layer enforces that
	// yet, so an update attempting to move a view to a different dashboard is only safe if the caller
	// can view both the view's current dashboard and whichever one it's being pointed at.
	if err := s.checkAccess(ctx, oldObj); err != nil {
		return err
	}
	return s.checkAccess(ctx, obj)
}

func (s *savedViewStorageAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return s.checkAccess(ctx, obj)
}

func (s *savedViewStorageAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	return s.checkAccess(ctx, obj)
}

// FilterList re-checks every item individually rather than trusting the request's fieldSelector, so an
// unscoped LIST can't be used to enumerate Saved Views (and thus dashboard UIDs and filter values)
// across dashboards the caller can't view.
func (s *savedViewStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	views, ok := list.(*dashboardviewsv0alpha1.SavedDashboardViewList)
	if !ok {
		return nil, storewrapper.ErrUnexpectedType
	}

	allowed := make([]dashboardviewsv0alpha1.SavedDashboardView, 0, len(views.Items))
	for i := range views.Items {
		if s.checkAccess(ctx, &views.Items[i]) == nil {
			allowed = append(allowed, views.Items[i])
		}
	}
	views.Items = allowed
	return views, nil
}

// WatchFilter denies Watch outright. Saved Views have no live-update use case in this spec, so this is
// deliberately the safe default rather than a filter for a path nothing calls.
func (s *savedViewStorageAuthorizer) WatchFilter(_ context.Context) (storewrapper.WatchEventFilter, error) {
	return storewrapper.RejectAllWatchFilter, nil
}

// checkAccess evaluates accesscontrol.AccessControl.Evaluate directly rather than the newer
// authtypes.AccessClient/BatchCheck path. That matters here: Evaluate's globally-registered
// "dashboards:uid:" scope resolver walks the full folder ancestry automatically, so a caller who can
// only view the dashboard through a folder-level grant (not a direct one) is still allowed.
// accessClient.BatchCheck has no equivalent — it requires the caller to resolve and pass the parent
// folder itself (see the annotation app's DashboardFolderResolver), and silently falls back to
// root-folder scoping if that step is skipped.
func (s *savedViewStorageAuthorizer) checkAccess(ctx context.Context, obj runtime.Object) error {
	view, ok := obj.(*dashboardviewsv0alpha1.SavedDashboardView)
	if !ok {
		return storewrapper.ErrUnexpectedType
	}
	if view.Spec.DashboardUID == "" {
		return storewrapper.ErrUnauthorized
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return storewrapper.ErrUnauthenticated
	}

	scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(view.Spec.DashboardUID)
	allowed, err := s.ac.Evaluate(ctx, requester, accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, scope))
	if err != nil {
		return err
	}
	if !allowed {
		return storewrapper.ErrUnauthorized
	}
	return nil
}

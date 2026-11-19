package dashboardviews

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/validate/content"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	claims "github.com/grafana/authlib/types"

	dashboardviewsv0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// Dashboard UIDs are resource names.
const maxDashboardUIDLength = 253

var (
	logger = log.New("dashboardviews.authz")

	// A 403, not storewrapper's 401: the frontend treats a 401 as an expired session and retries.
	errDenied = apierrors.NewForbidden(
		schema.GroupResource{Group: dashboardviewsv0alpha1.APIGroup, Resource: dashboardviewsv0alpha1.SavedDashboardViewKind().Plural()},
		"", errors.New("access denied"))
	errAccessCheckFailed = apierrors.NewInternalError(errors.New("could not check saved view access"))

	// Views are user content only. The store runs as a service identity, which would otherwise skip
	// the manager checks these annotations normally get.
	reservedAnnotations = []string{
		utils.AnnoKeyManagerKind,
		utils.AnnoKeyManagerIdentity,
		utils.AnnoKeyManagerAllowsEdits,
		utils.AnnoKeyManagerSuspended,
		utils.AnnoKeySourcePath,
		utils.AnnoKeySourceChecksum,
		utils.AnnoKeySourceTimestamp,
	}
)

// GetNamespaceScopedStorageAuthorizer is where the real per-object check lives: it's the first
// point with both the object (for spec.dashboardUID) and the caller's identity.
func (a *AppInstaller) GetNamespaceScopedStorageAuthorizer(_ schema.GroupResource) storewrapper.ResourceStorageAuthorizer {
	return &savedViewStorageAuthorizer{ac: a.ac, dashboardSvc: a.dashboardSvc}
}

// savedViewStorageAuthorizer gates every verb on dashboards:read for spec.dashboardUID. Writes too,
// deliberately: any dashboard viewer can manage its saved views.
type savedViewStorageAuthorizer struct {
	ac           accesscontrol.AccessControl
	dashboardSvc dashboards.DashboardService
}

func (s *savedViewStorageAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	if err := denyAnonymousWrite(ctx); err != nil {
		return err
	}
	if err := s.checkAccess(ctx, obj); err != nil {
		return err
	}
	view, ok := obj.(*dashboardviewsv0alpha1.SavedDashboardView)
	if !ok {
		return storewrapper.ErrUnexpectedType
	}
	if err := rejectReservedAnnotations(view); err != nil {
		return err
	}
	// A wildcard dashboards:read grant skips scope resolution, so checkAccess passes for any UID.
	exists, err := s.dashboardExists(ctx, view.Spec.DashboardUID)
	if err != nil {
		return err
	}
	if !exists {
		return errDenied
	}
	return nil
}

// BeforeUpdate keeps spec.dashboardUID immutable, since the existence check only runs on create.
func (s *savedViewStorageAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	if err := denyAnonymousWrite(ctx); err != nil {
		return err
	}
	if err := s.checkAccess(ctx, oldObj); err != nil {
		return err
	}
	oldView, ok := oldObj.(*dashboardviewsv0alpha1.SavedDashboardView)
	if !ok {
		return storewrapper.ErrUnexpectedType
	}
	newView, ok := obj.(*dashboardviewsv0alpha1.SavedDashboardView)
	if !ok {
		return storewrapper.ErrUnexpectedType
	}
	if oldView.Spec.DashboardUID != newView.Spec.DashboardUID {
		return apierrors.NewBadRequest("spec.dashboardUID is immutable")
	}
	return rejectReservedAnnotations(newView)
}

func (s *savedViewStorageAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	if err := denyAnonymousWrite(ctx); err != nil {
		return err
	}
	return s.checkAccess(ctx, obj)
}

// AfterGet and FilterList hide views whose dashboard was deleted; delete stays allowed so they can
// be cleaned up.
func (s *savedViewStorageAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	if err := s.checkAccess(ctx, obj); err != nil {
		return err
	}
	view, ok := obj.(*dashboardviewsv0alpha1.SavedDashboardView)
	if !ok {
		return storewrapper.ErrUnexpectedType
	}
	exists, err := s.dashboardExists(ctx, view.Spec.DashboardUID)
	if err != nil {
		return err
	}
	if !exists {
		return errDenied
	}
	return nil
}

// FilterList checks each item rather than trusting the fieldSelector, so an unscoped LIST can't leak
// other dashboards' views. Only a denial drops an item; any other error fails the request.
func (s *savedViewStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	views, ok := list.(*dashboardviewsv0alpha1.SavedDashboardViewList)
	if !ok {
		return nil, storewrapper.ErrUnexpectedType
	}
	// Grafana's own service identity, e.g. the validator counting a dashboard's views, sees them all.
	if identity.IsServiceIdentity(ctx) {
		return views, nil
	}

	allowed := make([]dashboardviewsv0alpha1.SavedDashboardView, 0, len(views.Items))
	// Lists are normally scoped to one dashboard, so this is usually a single lookup.
	exists := map[string]bool{}
	for i := range views.Items {
		err := s.checkAccess(ctx, &views.Items[i])
		switch {
		case err == nil:
		case apierrors.IsForbidden(err):
			continue
		default:
			return nil, err
		}

		uid := views.Items[i].Spec.DashboardUID
		found, checked := exists[uid]
		if !checked {
			if found, err = s.dashboardExists(ctx, uid); err != nil {
				return nil, err
			}
			exists[uid] = found
		}
		if found {
			allowed = append(allowed, views.Items[i])
		}
	}
	views.Items = allowed
	return views, nil
}

// WatchFilter denies Watch outright; nothing uses it.
func (s *savedViewStorageAuthorizer) WatchFilter(_ context.Context) (storewrapper.WatchEventFilter, error) {
	return storewrapper.RejectAllWatchFilter, nil
}

// denyAnonymousWrite keeps anonymous visitors from changing views that every viewer shares.
func denyAnonymousWrite(ctx context.Context) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return storewrapper.ErrUnauthenticated
	}
	if requester.IsIdentityType(claims.TypeAnonymous) {
		return errDenied
	}
	return nil
}

func rejectReservedAnnotations(view *dashboardviewsv0alpha1.SavedDashboardView) error {
	annotations := view.GetAnnotations()
	for _, key := range reservedAnnotations {
		if _, ok := annotations[key]; ok {
			return apierrors.NewBadRequest(fmt.Sprintf("annotation %q is not supported on saved views", key))
		}
	}
	return nil
}

// checkAccess uses AccessControl.Evaluate rather than AccessClient.BatchCheck because Evaluate's
// dashboard scope resolver walks folder ancestry, so folder-level grants count.
func (s *savedViewStorageAuthorizer) checkAccess(ctx context.Context, obj runtime.Object) error {
	view, ok := obj.(*dashboardviewsv0alpha1.SavedDashboardView)
	if !ok {
		return storewrapper.ErrUnexpectedType
	}
	// A malformed UID can't name a dashboard; deny it before it reaches the scope resolver, which
	// would fail with a 500. This runs before admission, so the validator can't catch it first.
	if len(view.Spec.DashboardUID) == 0 || len(view.Spec.DashboardUID) > maxDashboardUIDLength ||
		len(content.IsPathSegmentName(view.Spec.DashboardUID)) > 0 {
		return errDenied
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return storewrapper.ErrUnauthenticated
	}

	// Evaluate uses the requester's org permissions, but anonymous users and server admins pass the
	// namespace authorizer for any org.
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil || nsInfo.OrgID != requester.GetOrgID() {
		return errDenied
	}

	scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(view.Spec.DashboardUID)
	allowed, err := s.ac.Evaluate(ctx, requester, accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, scope))
	if errors.Is(err, dashboards.ErrDashboardNotFound) {
		// The scope resolver fails for a deleted dashboard; deny rather than 500.
		return errDenied
	}
	if err != nil {
		logger.Error("Failed to evaluate saved view access", "dashboardUID", view.Spec.DashboardUID, "error", err)
		return errAccessCheckFailed
	}
	if !allowed {
		return errDenied
	}
	return nil
}

// dashboardExists runs as a service identity: checkAccess already authorized the caller, and this
// only asks whether the dashboard is still there.
func (s *savedViewStorageAuthorizer) dashboardExists(ctx context.Context, uid string) (bool, error) {
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return false, errDenied
	}

	_, err = identity.WithServiceIdentityFn(ctx, nsInfo.OrgID, func(ctx context.Context) (*dashboards.Dashboard, error) {
		return s.dashboardSvc.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: uid, OrgID: nsInfo.OrgID})
	})
	switch {
	case err == nil:
		return true, nil
	case errors.Is(err, dashboards.ErrDashboardNotFound):
		return false, nil
	default:
		logger.Error("Failed to look up the dashboard of a saved view", "dashboardUID", uid, "error", err)
		return false, errAccessCheckFailed
	}
}

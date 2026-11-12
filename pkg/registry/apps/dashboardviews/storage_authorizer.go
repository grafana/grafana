package dashboardviews

import (
	"context"
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardviewsv0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
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
	if err := s.checkAccess(ctx, obj); err != nil {
		return err
	}
	return s.checkDashboardExists(ctx, obj)
}

// BeforeUpdate keeps spec.dashboardUID immutable, since checkDashboardExists only runs on create.
func (s *savedViewStorageAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
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
	return nil
}

func (s *savedViewStorageAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return s.checkAccess(ctx, obj)
}

func (s *savedViewStorageAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	return s.checkAccess(ctx, obj)
}

// FilterList checks each item rather than trusting the fieldSelector, so an unscoped LIST can't leak
// other dashboards' views. Only a denial drops an item; any other error fails the request.
func (s *savedViewStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	views, ok := list.(*dashboardviewsv0alpha1.SavedDashboardViewList)
	if !ok {
		return nil, storewrapper.ErrUnexpectedType
	}

	allowed := make([]dashboardviewsv0alpha1.SavedDashboardView, 0, len(views.Items))
	for i := range views.Items {
		err := s.checkAccess(ctx, &views.Items[i])
		switch {
		case err == nil:
			allowed = append(allowed, views.Items[i])
		case errors.Is(err, storewrapper.ErrUnauthorized):
		case errors.Is(err, storewrapper.ErrUnauthenticated):
			return nil, err
		default:
			return nil, apierrors.NewInternalError(err)
		}
	}
	views.Items = allowed
	return views, nil
}

// WatchFilter denies Watch outright; nothing uses it.
func (s *savedViewStorageAuthorizer) WatchFilter(_ context.Context) (storewrapper.WatchEventFilter, error) {
	return storewrapper.RejectAllWatchFilter, nil
}

// checkAccess uses AccessControl.Evaluate rather than AccessClient.BatchCheck because Evaluate's
// dashboard scope resolver walks folder ancestry, so folder-level grants count.
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

// checkDashboardExists runs on create only: a wildcard dashboards:read grant passes checkAccess
// for any UID. It returns ErrUnauthorized rather than not-found so it can't probe for UIDs.
func (s *savedViewStorageAuthorizer) checkDashboardExists(ctx context.Context, obj runtime.Object) error {
	view, ok := obj.(*dashboardviewsv0alpha1.SavedDashboardView)
	if !ok {
		return storewrapper.ErrUnexpectedType
	}

	// Use the request's namespace org, not the caller's; they differ for admins and service identities.
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return storewrapper.ErrUnauthorized
	}

	// Run as a service identity: checkAccess already authorized the caller, this only checks existence.
	_, err = identity.WithServiceIdentityFn(ctx, nsInfo.OrgID, func(ctx context.Context) (*dashboards.Dashboard, error) {
		return s.dashboardSvc.GetDashboard(ctx, &dashboards.GetDashboardQuery{
			UID:   view.Spec.DashboardUID,
			OrgID: nsInfo.OrgID,
		})
	})
	switch {
	case err == nil:
		return nil
	case errors.Is(err, dashboards.ErrDashboardNotFound):
		return storewrapper.ErrUnauthorized
	default:
		return apierrors.NewInternalError(err)
	}
}

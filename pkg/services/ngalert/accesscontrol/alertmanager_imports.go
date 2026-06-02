package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// AlertmanagerImportsAccess implements notifier.ExtraConfigAuthz using RBAC.
type AlertmanagerImportsAccess struct {
	genericService
}

func NewAlertmanagerImportsAccess(a ac.AccessControl) *AlertmanagerImportsAccess {
	return &AlertmanagerImportsAccess{genericService: genericService{ac: a}}
}

// AuthorizeCreate checks the org-level create permission. No legacy fallback — callers
// must hold the explicit create action.
func (s *AlertmanagerImportsAccess) AuthorizeCreate(ctx context.Context, user identity.Requester) error {
	return s.HasAccessOrError(ctx, user,
		ac.EvalPermission(ac.ActionAlertingAlertmanagerImportsCreate),
		func() string { return "create alertmanager imports" },
	)
}

// AuthorizeUpdate checks the scoped update permission, with legacy notifications:write as fallback.
func (s *AlertmanagerImportsAccess) AuthorizeUpdate(ctx context.Context, user identity.Requester, identifier string) error {
	return s.HasAccessOrError(ctx, user, ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
		ac.EvalPermission(
			ac.ActionAlertingAlertmanagerImportsWrite,
			models.ScopeAlertmanagerImportsProvider.GetResourceScopeUID(identifier),
		),
	), func() string { return "update alertmanager import" })
}

// AuthorizeDelete checks the scoped delete permission, with legacy notifications:write as fallback.
func (s *AlertmanagerImportsAccess) AuthorizeDelete(ctx context.Context, user identity.Requester, identifier string) error {
	return s.HasAccessOrError(ctx, user, ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
		ac.EvalPermission(
			ac.ActionAlertingAlertmanagerImportsDelete,
			models.ScopeAlertmanagerImportsProvider.GetResourceScopeUID(identifier),
		),
	), func() string { return "delete alertmanager import" })
}

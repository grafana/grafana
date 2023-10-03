package searchV2

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

// ResourceFilter checks if a given a uid (resource identifier) check if we have the requested permission
type ResourceFilter func(kind entityKind, uid, parentUID string) bool

// FutureAuthService eventually implemented by the security service
type FutureAuthService interface {
	GetDashboardReadFilter(ctx context.Context, orgID int64, user *user.SignedInUser) (ResourceFilter, error)
}

var _ FutureAuthService = (*simpleAuthService)(nil)

type simpleAuthService struct {
	sql           db.DB
	ac            accesscontrol.Service
	folderService folder.Service
	logger        log.Logger
}

func (a *simpleAuthService) GetDashboardReadFilter(ctx context.Context, orgID int64, user *user.SignedInUser) (ResourceFilter, error) {
	canReadDashboard, canReadFolder := accesscontrol.Checker(user, dashboards.ActionDashboardsRead), accesscontrol.Checker(user, dashboards.ActionFoldersRead)
	return func(kind entityKind, uid, parent string) bool {
		if kind == entityKindFolder {
			scopes, err := dashboards.GetInheritedScopes(ctx, orgID, uid, a.folderService)
			if err != nil {
				a.logger.Debug("Could not retrieve inherited folder scopes:", "err", err)
			}
			scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(uid))
			return canReadFolder(scopes...)
		} else if kind == entityKindDashboard {
			scopes, err := dashboards.GetInheritedScopes(ctx, orgID, parent, a.folderService)
			if err != nil {
				a.logger.Debug("Could not retrieve inherited folder scopes:", "err", err)
			}
			scopes = append(scopes, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid))
			scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(parent))
			return canReadDashboard(scopes...)
		}
		return false
	}, nil
}

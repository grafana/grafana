package searchV2

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/user"
)

// ResourceFilter checks if a given a uid (resource identifier) check if we have the requested permission
type ResourceFilter func(kind entityKind, uid, parent string) bool

// FutureAuthService eventually implemented by the security service
type FutureAuthService interface {
	GetDashboardReadFilter(user *user.SignedInUser) (ResourceFilter, error)
}

var _ FutureAuthService = (*simpleAuthService)(nil)

type simpleAuthService struct {
	sql db.DB
	ac  accesscontrol.Service
}

type dashIdQueryResult struct {
	UID string `xorm:"uid"`
}

func (a *simpleAuthService) GetDashboardReadFilter(user *user.SignedInUser) (ResourceFilter, error) {
	if !a.ac.IsDisabled() {
		canReadDashboard, canReadFolder := accesscontrol.Checker(user, dashboards.ActionDashboardsRead), accesscontrol.Checker(user, dashboards.ActionFoldersRead)
		return func(kind entityKind, uid, parent string) bool {
			if kind == entityKindFolder {
				return canReadFolder(dashboards.ScopeFoldersProvider.GetResourceScopeUID(uid))
			} else if kind == entityKindDashboard {
				return canReadDashboard(dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid), dashboards.ScopeFoldersProvider.GetResourceScopeUID(parent))
			}
			return false
		}, nil
	}

	filter := permissions.DashboardPermissionFilter{
		OrgRole:         user.OrgRole,
		OrgId:           user.OrgID,
		Dialect:         a.sql.GetDialect(),
		UserId:          user.UserID,
		PermissionLevel: models.PERMISSION_VIEW,
	}
	rows := make([]*dashIdQueryResult, 0)

	err := a.sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		sql, params := filter.Where()
		sess.Table("dashboard").
			Where(sql, params...).
			Where("org_id = ?", user.OrgID).
			Cols("uid")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	uids := make(map[string]bool, len(rows)+1)
	for i := 0; i < len(rows); i++ {
		uids[rows[i].UID] = true
	}

	return func(_ entityKind, _, uid string) bool {
		return uids[uid]
	}, err
}

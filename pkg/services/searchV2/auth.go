package searchV2

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
)

// ResourceFilter checks if a given a uid (resource identifier) check if we have the requested permission
type ResourceFilter func(uid string) bool

// FutureAuthService eventually implemented by the security service
type FutureAuthService interface {
	GetDashboardReadFilter(user *user.SignedInUser) (ResourceFilter, error)
}

var _ FutureAuthService = (*simpleSQLAuthService)(nil)

type simpleSQLAuthService struct {
	sql *sqlstore.SQLStore
	ac  accesscontrol.Service
}

type dashIdQueryResult struct {
	UID string `xorm:"uid"`
}

func (a *simpleSQLAuthService) getDashboardTableAuthFilter(user *user.SignedInUser) searchstore.FilterWhere {
	if a.ac.IsDisabled() {
		return permissions.DashboardPermissionFilter{
			OrgRole:         user.OrgRole,
			OrgId:           user.OrgID,
			Dialect:         a.sql.Dialect,
			UserId:          user.UserID,
			PermissionLevel: models.PERMISSION_VIEW,
		}
	}

	return permissions.NewAccessControlDashboardPermissionFilter(user, models.PERMISSION_VIEW, searchstore.TypeDashboard)
}

func (a *simpleSQLAuthService) GetDashboardReadFilter(user *user.SignedInUser) (ResourceFilter, error) {
	filter := a.getDashboardTableAuthFilter(user)
	rows := make([]*dashIdQueryResult, 0)

	err := a.sql.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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

	return func(uid string) bool {
		return uids[uid]
	}, err
}

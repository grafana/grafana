package searchV2

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
)

// ResourceFilter checks if a given a uid (resource identifier) check if we have the requested permission
type ResourceFilter func(uid string) bool

// FutureAuthService eventually implemented by the security service
type FutureAuthService interface {
	GetDashboardReadFilter(user *models.SignedInUser) (ResourceFilter, error)
}

type simpleSQLAuthService struct {
	sql *sqlstore.SQLStore
}

type dashIdQueryResult struct {
	UID string `xorm:"uid"`
}

func (a *simpleSQLAuthService) GetDashboardReadFilter(user *models.SignedInUser) (ResourceFilter, error) {
	// this filter works on the legacy `dashboard_acl` table
	// we will also need to use `accesscontrol` after https://github.com/grafana/grafana/pull/44702/files is merged
	// see https://github.com/grafana/grafana/blob/e355bd6d3a04111b8c9959f85e81beabbeb746bf/pkg/services/sqlstore/permissions/dashboard.go#L84
	filter := permissions.DashboardPermissionFilter{
		OrgRole:         user.OrgRole,
		OrgId:           user.OrgId,
		Dialect:         a.sql.Dialect,
		UserId:          user.UserId,
		PermissionLevel: models.PERMISSION_VIEW,
	}

	rows := make([]*dashIdQueryResult, 0)

	err := a.sql.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		sql, params := filter.Where()
		sess.Table("dashboard").
			Where(sql, params...).
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

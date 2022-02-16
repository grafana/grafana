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

	dialect := a.sql.Dialect

	filter := permissions.DashboardPermissionFilter{
		OrgRole:         user.OrgRole,
		OrgId:           user.OrgId,
		Dialect:         dialect,
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

	var uids []string
	for i := 0; i < len(rows); i++ {
		uids = append(uids, rows[i].UID)
	}

	return uidFilter{uids: uids}.filter, err
}

type uidFilter struct {
	uids []string
}

func (f *uidFilter) filter(uid string) bool {
	for _, u := range f.uids {
		if u == uid {
			return true
		}
	}

	return false
}

func alwaysTrueFilter(uid string) bool {
	return true
}

func alwaysFalseFilter(uid string) bool {
	return true
}

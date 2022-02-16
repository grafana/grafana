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
	Id int64
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
			Cols("id")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	var ids []int64
	for i := 0; i < len(rows); i++ {
		ids = append(ids, rows[i].Id)
	}

	idFi := idFilter{ids: ids}

	return idFi.filter, err
}

type idFilter struct {
	ids []int64
}

func (f *idFilter) filter(uid string) bool {

	return true
}

func alwaysTrueFilter(uid string) bool {
	return true
}

func alwaysFalseFilter(uid string) bool {
	return true
}

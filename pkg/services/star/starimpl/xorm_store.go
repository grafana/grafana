package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/star"
)

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) Get(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	var isStarred bool
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		if query.DashboardUID != "" && query.OrgID != 0 {
			rawSQL := "SELECT 1 from star where user_id=? and dashboard_uid=? and org_id=?"
			results, err := sess.Query(rawSQL, query.UserID, query.DashboardUID, query.OrgID)

			if err != nil {
				return err
			}

			isStarred = len(results) != 0
			return nil
		}

		// TODO: Remove this block after all dashboards have a UID
		// && the deprecated endpoints have been removed
		rawSQL := "SELECT 1 from star where user_id=? and dashboard_id=?"
		results, err := sess.Query(rawSQL, query.UserID, query.DashboardID)
		if err != nil {
			return err
		}

		isStarred = len(results) != 0
		return nil
	})
	return isStarred, err
}

func (s *sqlStore) Insert(ctx context.Context, cmd *star.StarDashboardCommand) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		entity := star.Star{
			UserID: cmd.UserID,
			// nolint:staticcheck
			DashboardID:  cmd.DashboardID,
			DashboardUID: cmd.DashboardUID,
			OrgID:        cmd.OrgID,
			Updated:      cmd.Updated,
		}

		_, err := sess.Insert(&entity)
		if s.db.GetDialect().IsUniqueConstraintViolation(err) {
			return nil
		}

		return err
	})
}

func (s *sqlStore) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if cmd.DashboardUID != "" && cmd.OrgID != 0 {
			var rawSQL = "DELETE FROM star WHERE user_id=? and dashboard_uid=? and org_id=?"
			_, err := sess.Exec(rawSQL, cmd.UserID, cmd.DashboardUID, cmd.OrgID)
			return err
		}

		// TODO: Remove this block after all dashboards have a UID
		// && the deprecated endpoints have been removed
		var rawSQL = "DELETE FROM star WHERE user_id=? and dashboard_id=?"
		// nolint:staticcheck
		_, err := sess.Exec(rawSQL, cmd.UserID, cmd.DashboardID)
		return err
	})
}

func (s *sqlStore) DeleteByUser(ctx context.Context, userID int64) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "DELETE FROM star WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
}

func (s *sqlStore) List(ctx context.Context, query *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	userStars := make(map[string]bool)
	err := s.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var stars = make([]star.Star, 0)
		err := dbSession.Where("user_id=?", query.UserID).Find(&stars)
		for _, star := range stars {
			userStars[star.DashboardUID] = true
		}
		return err
	})
	return &star.GetUserStarsResult{UserStars: userStars}, err
}

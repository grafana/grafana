package starimpl

import (
	"context"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/star"
)

// dashboardIDCounter provides a monotonic per-process offset used to generate
// a synthetic unique dashboard_id value for new star rows. The dashboard_id
// column is no longer used by the star service, but the legacy
// UNIQUE (user_id, dashboard_id) index is still present (see star_mig.go).
// Combining time.Now().UnixMicro() with an atomic counter guarantees uniqueness
// for every Insert within a process, avoiding silent unique-constraint
// violations when Add() is called in quick succession.
var dashboardIDCounter atomic.Int64

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) Get(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	var isStarred bool
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "SELECT 1 from star where user_id=? and dashboard_uid=? and org_id=?"
		results, err := sess.Query(rawSQL, query.UserID, query.DashboardUID, query.OrgID)

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
		// nolint:staticcheck
		if cmd.DashboardID == 0 {
			// Use UnixMicro plus a monotonic counter so the generated value is
			// guaranteed unique within this process, even for calls that happen
			// in the same microsecond. This avoids hitting the legacy
			// UNIQUE (user_id, dashboard_id) index, which would otherwise be
			// silently swallowed by Add() and cause data loss.
			cmd.DashboardID = time.Now().UnixMicro() + dashboardIDCounter.Add(1)
		}

		entity := star.Star{
			UserID: cmd.UserID,
			// nolint:staticcheck
			DashboardID:  cmd.DashboardID,
			DashboardUID: cmd.DashboardUID,
			OrgID:        cmd.OrgID,
			Updated:      cmd.Updated,
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func (s *sqlStore) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "DELETE FROM star WHERE user_id=? and dashboard_uid=? and org_id=?"
		_, err := sess.Exec(rawSQL, cmd.UserID, cmd.DashboardUID, cmd.OrgID)
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

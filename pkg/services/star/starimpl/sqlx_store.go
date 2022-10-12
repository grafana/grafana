package starimpl

import (
	"context"
	"database/sql"
	"errors"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/star"
)

type sqlxStore struct {
	sess *session.SessionDB
}

func (s *sqlxStore) Get(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	var star_res star.Star
	err := s.sess.Get(ctx, &star_res, "SELECT * from star where user_id=? and dashboard_id=?", query.UserID, query.DashboardID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (s *sqlxStore) Insert(ctx context.Context, cmd *star.StarDashboardCommand) error {
	entity := star.Star{
		UserID:      cmd.UserID,
		DashboardID: cmd.DashboardID,
	}
	_, err := s.sess.NamedExec(ctx, `INSERT INTO star (user_id, dashboard_id) VALUES (:user_id, :dashboard_id)`, entity)
	if err != nil {
		return err
	}
	return err
}

func (s *sqlxStore) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	_, err := s.sess.Exec(ctx, "DELETE FROM star WHERE user_id=? and dashboard_id=?", cmd.UserID, cmd.DashboardID)
	return err
}

func (s *sqlxStore) DeleteByUser(ctx context.Context, userID int64) error {
	_, err := s.sess.Exec(ctx, "DELETE FROM star WHERE user_id = ?", userID)
	return err
}

func (s *sqlxStore) List(ctx context.Context, query *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	userStars := make(map[int64]bool)
	var stars = make([]star.Star, 0)
	err := s.sess.Select(ctx, &stars, "SELECT * FROM star WHERE user_id=?", query.UserID)
	if err != nil {
		return nil, err
	}
	for _, star := range stars {
		userStars[star.DashboardID] = true
	}

	return &star.GetUserStarsResult{UserStars: userStars}, err
}

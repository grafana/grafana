package prefimpl

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type sqlxStore struct {
	sess *session.SessionDB
}

func (s *sqlxStore) Get(ctx context.Context, query *pref.Preference) (*pref.Preference, error) {
	var prefs pref.Preference
	err := s.sess.Get(ctx, &prefs, "SELECT * from preferences WHERE org_id=? AND user_id=? AND team_id=?", query.OrgID, query.UserID, query.TeamID)
	if err != nil && errors.Is(err, sql.ErrNoRows) {
		return nil, pref.ErrPrefNotFound
	}
	return &prefs, err
}

func (s *sqlxStore) List(ctx context.Context, query *pref.Preference) ([]*pref.Preference, error) {
	prefs := make([]*pref.Preference, 0)
	params := make([]interface{}, 0)
	filter := ""

	if len(query.Teams) > 0 {
		filter = "(org_id=? AND team_id IN (?" + strings.Repeat(",?", len(query.Teams)-1) + ")) OR "
		params = append(params, query.OrgID)
		for _, v := range query.Teams {
			params = append(params, v)
		}
	}

	filter += "(org_id=? AND user_id=? AND team_id=0) OR (org_id=? AND team_id=0 AND user_id=0)"
	params = append(params, query.OrgID)
	params = append(params, query.UserID)
	params = append(params, query.OrgID)
	err := s.sess.Select(ctx, &prefs, fmt.Sprintf("SELECT * FROM preferences WHERE %s ORDER BY user_id ASC, team_id ASC", filter), params...)
	return prefs, err
}

func (s *sqlxStore) Update(ctx context.Context, cmd *pref.Preference) error {
	query := "UPDATE preferences SET org_id=:org_id, user_id=:user_id, team_id=:team_id, version=:version, home_dashboard_id=:home_dashboard_id, " +
		"timezone=:timezone, week_start=:week_start, theme=:theme, created=:created, updated=:updated, json_data=:json_data WHERE id=:id"
	_, err := s.sess.NamedExec(ctx, query, cmd)
	return err
}

func (s *sqlxStore) Insert(ctx context.Context, cmd *pref.Preference) (int64, error) {
	var ID int64
	query := "INSERT INTO preferences (org_id, user_id, team_id, version, home_dashboard_id, timezone, week_start, theme, created, updated, json_data) VALUES " +
		"(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
	ID, err := s.sess.ExecWithReturningId(
		ctx, query, cmd.OrgID, cmd.UserID, cmd.TeamID, cmd.Version, cmd.HomeDashboardID,
		cmd.Timezone, cmd.WeekStart, cmd.Theme, cmd.Created, cmd.Updated, cmd.JSONData)
	return ID, err
}

func (s *sqlxStore) DeleteByUser(ctx context.Context, userID int64) error {
	_, err := s.sess.Exec(ctx, "DELETE FROM preferences WHERE user_id=?", userID)
	return err
}

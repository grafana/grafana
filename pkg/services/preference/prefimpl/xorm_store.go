package prefimpl

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) Get(ctx context.Context, query *pref.Preference) (*pref.Preference, error) {
	var prefs pref.Preference
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Where("org_id=? AND user_id=? AND team_id=?", query.OrgID, query.UserID, query.TeamID).Get(&prefs)
		if err != nil {
			return err
		}
		if !exist {
			return pref.ErrPrefNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &prefs, nil
}

func (s *sqlStore) List(ctx context.Context, query *pref.Preference) ([]*pref.Preference, error) {
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

	err := s.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		err := dbSession.Where(filter, params...).
			OrderBy("user_id ASC, team_id ASC").
			Find(&prefs)

		if err != nil {
			return err
		}

		return nil
	})
	return prefs, err
}

func (s *sqlStore) Update(ctx context.Context, cmd *pref.Preference) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.ID(cmd.ID).AllCols().Update(cmd)
		return err
	})
}

func (s *sqlStore) Insert(ctx context.Context, cmd *pref.Preference) (int64, error) {
	var ID int64
	var err error
	err = s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err = sess.Insert(cmd)
		ID = cmd.ID
		return err
	})
	return ID, err
}

func (s *sqlStore) DeleteByUser(ctx context.Context, userID int64) error {
	return s.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var rawSQL = "DELETE FROM preferences WHERE user_id = ?"
		_, err := dbSession.Exec(rawSQL, userID)
		return err
	})
}

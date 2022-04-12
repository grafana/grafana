package prefimpl

import (
	"context"
	"fmt"
	"strings"

	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type store interface {
	Get(context.Context, *pref.GetPreferenceQuery) (*pref.Preference, error)
	List(context.Context, *pref.ListPreferenceQuery) ([]*pref.Preference, error)
	Insert(context.Context, *pref.InsertPreferenceQuery) error
	Update(context.Context, *pref.UpdatePreferenceQuery) error
}

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) Get(ctx context.Context, query *pref.GetPreferenceQuery) (*pref.Preference, error) {
	var prefs pref.Preference
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
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

func (s *sqlStore) List(ctx context.Context, query *pref.ListPreferenceQuery) ([]*pref.Preference, error) {
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

	err := s.db.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
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

func (s *sqlStore) Update(ctx context.Context, cmd *pref.UpdatePreferenceQuery) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.ID(&cmd.Id).AllCols().Update(cmd)
		return err
	})
}

func (s *sqlStore) Insert(ctx context.Context, cmd *pref.InsertPreferenceQuery) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		fmt.Println(cmd)
		_, err := sess.Insert(cmd)
		return err
	})
}

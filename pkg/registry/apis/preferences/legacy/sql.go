package legacy

import (
	"context"
	"fmt"
	"strconv"
	"time"

	authlib "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type dashboardStars struct {
	OrgID   int64
	UserUID string
	First   int64
	Last    int64

	Dashboards []string
}

type preferenceModel struct {
	ID               int64
	OrgID            int64
	UserUID          string
	TeamUID          string
	JSONData         *pref.PreferenceJSONData
	HomeDashboardUID string
	Timezone         string
	Theme            string
	WeekStart        string
	Created          time.Time
	Updated          time.Time
}

type LegacySQL struct {
	db legacysql.LegacyDatabaseProvider
}

func NewLegacySQL(db legacysql.LegacyDatabaseProvider) *LegacySQL {
	return &LegacySQL{db: db}
}

// NOTE: this does not support paging -- lets check if that will be a problem in cloud
func (s *LegacySQL) GetStars(ctx context.Context, orgId int64, user string) ([]dashboardStars, int64, error) {
	sql, err := s.db(ctx)
	if err != nil {
		return nil, 0, err
	}

	req := newStarQueryReq(sql, user, orgId)

	q, err := sqltemplate.Execute(sqlStarsQuery, req)
	if err != nil {
		return nil, 0, fmt.Errorf("execute template %q: %w", sqlStarsQuery.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	rows, err := sess.Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	stars := []dashboardStars{}
	current := &dashboardStars{}
	var orgID int64
	var userUID string
	var dashboardUID string
	var updated time.Time

	for rows.Next() {
		err := rows.Scan(&orgID, &userUID, &dashboardUID, &updated)
		if err != nil {
			return nil, 0, err
		}

		if orgID != current.OrgID || userUID != current.UserUID {
			if current.UserUID != "" {
				stars = append(stars, *current)
			}
			current = &dashboardStars{
				OrgID:   orgID,
				UserUID: userUID,
			}
		}
		ts := updated.UnixMilli()
		if ts > current.Last {
			current.Last = ts
		}
		if ts < current.First || current.First == 0 {
			current.First = ts
		}
		current.Dashboards = append(current.Dashboards, dashboardUID)
	}

	// Add the last value
	if current.UserUID != "" {
		stars = append(stars, *current)
	}

	// Find the RV unless it is a user query
	if userUID == "" {
		req.Reset()
		q, err = sqltemplate.Execute(sqlStarsRV, req)
		if err != nil {
			return nil, 0, fmt.Errorf("execute template %q: %w", sqlStarsRV.Name(), err)
		}
		err = sess.Select(ctx, &updated, q)
	}

	return stars, updated.UnixMilli(), err
}

// List all defined preferences in an org (valid for admin users only)
func (s *LegacySQL) listPreferences(ctx context.Context, orgId int64,
	cb func(req *preferencesQuery) (bool, error),
) ([]preferenceModel, int64, error) {
	sql, err := s.db(ctx)
	if err != nil {
		return nil, 0, err
	}

	req := newPreferencesQueryReq(sql, orgId)
	needsRV, err := cb(&req)
	if err != nil {
		return nil, 0, err
	}

	q, err := sqltemplate.Execute(sqlStarsQuery, req)
	if err != nil {
		return nil, 0, fmt.Errorf("execute template %q: %w", sqlStarsQuery.Name(), err)
	}

	var results []preferenceModel
	var rv time.Time
	sess := sql.DB.GetSqlxSession()
	rows, err := sess.Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	for rows.Next() {
		pref := preferenceModel{}
		err := rows.Scan(&pref.ID, &pref.OrgID, &pref.UserUID, &pref.TeamUID, &pref.JSONData,
			&pref.HomeDashboardUID, &pref.Timezone, &pref.Theme, &pref.WeekStart,
			&pref.Created, &pref.Updated)
		if err != nil {
			return nil, 0, err
		}

		if pref.Updated.After(rv) {
			rv = pref.Updated
		}
		results = append(results, pref)
	}

	if needsRV {
		q, err = sqltemplate.Execute(sqlPreferencesRV, req)
		if err != nil {
			return nil, 0, fmt.Errorf("execute template %q: %w", sqlPreferencesRV.Name(), err)
		}
		err = sess.Select(ctx, &rv, q)
	}
	return results, rv.UnixMilli(), err
}

func (s *LegacySQL) ListPreferences(ctx context.Context, ns string, user string) (*preferences.PreferencesList, error) {
	info, err := authlib.ParseNamespace(ns)
	if err != nil {
		return nil, err
	}

	list := &preferences.PreferencesList{}
	found, rv, err := s.listPreferences(ctx, info.OrgID, func(req *preferencesQuery) (bool, error) {
		if req.UserUID != "" {
			req.UserUID = user
			req.UserTeams, err = s.GetTeams(ctx, info.OrgID, user, false)
		}
		return true, err
	})
	if err != nil {
		return nil, err
	}
	for _, v := range found {
		list.Items = append(list.Items, asPreferencesResource(ns, &v))
	}
	if rv > 0 {
		list.ResourceVersion = strconv.FormatInt(rv, 10)
	}
	return list, nil
}

func (s *LegacySQL) GetTeams(ctx context.Context, orgId int64, user string, admin bool) ([]string, error) {
	sql, err := s.db(ctx)
	if err != nil {
		return nil, err
	}

	var teams []string
	req := newTeamsQueryReq(sql, orgId, user, admin)

	q, err := sqltemplate.Execute(sqlTeams, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlTeams.Name(), err)
	}
	sess := sql.DB.GetSqlxSession()
	err = sess.Select(ctx, &teams, q)
	return teams, err
}

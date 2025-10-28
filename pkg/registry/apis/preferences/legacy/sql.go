package legacy

import (
	"context"
	"database/sql"
	"fmt"
	"slices"
	"strconv"
	"time"

	authlib "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/user"
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
	UserUID          sql.NullString
	TeamUID          sql.NullString
	JSONData         *pref.PreferenceJSONData
	HomeDashboardUID sql.NullString
	Timezone         sql.NullString
	Theme            sql.NullString
	WeekStart        sql.NullString
	Created          time.Time
	Updated          time.Time
}

type LegacySQL struct {
	db      legacysql.LegacyDatabaseProvider
	startup time.Time
}

func NewLegacySQL(db legacysql.LegacyDatabaseProvider) *LegacySQL {
	return &LegacySQL{db: db, startup: time.Now()}
}

// NOTE: this does not support paging -- lets check if that will be a problem in cloud
func (s *LegacySQL) getDashboardStars(ctx context.Context, orgId int64, user string) ([]dashboardStars, int64, error) {
	var max sql.NullString
	sql, err := s.db(ctx)
	if err != nil {
		return nil, 0, err
	}

	req := newStarQueryReq(sql, user, orgId)

	q, err := sqltemplate.Execute(sqlDashboardStarsQuery, req)
	if err != nil {
		return nil, 0, fmt.Errorf("execute template %q: %w", sqlDashboardStarsQuery.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	rows, err := sess.Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, 0, err
	}
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
		q, err = sqltemplate.Execute(sqlDashboardStarsRV, req)
		if err != nil {
			return nil, 0, fmt.Errorf("execute template %q: %w", sqlPreferencesRV.Name(), err)
		}
		err = sess.Get(ctx, &max, q)
		if err != nil {
			return nil, 0, fmt.Errorf("unable to get RV %w", err)
		}
		if max.Valid && max.String != "" {
			t, _ := time.Parse(time.RFC3339, max.String)
			if !t.IsZero() {
				updated = t
			}
		} else {
			updated = s.startup
		}
	}

	return stars, updated.UnixMilli(), err
}

func (s *LegacySQL) getHistoryStars(ctx context.Context, orgId int64, user string) (map[string][]string, error) {
	sql, err := s.db(ctx)
	if err != nil {
		return nil, err
	}
	req := newStarQueryReq(sql, user, orgId)

	q, err := sqltemplate.Execute(sqlHistoryStarsQuery, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlHistoryStarsQuery.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	rows, err := sess.Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	last := user
	res := make(map[string][]string)
	buffer := make([]string, 0, 10)
	var uid string

	for rows.Next() {
		err := rows.Scan(&uid, &user)
		if err != nil {
			return nil, err
		}
		if user != last && len(buffer) > 0 {
			res[last] = buffer
			buffer = make([]string, 0, 10)
		}
		buffer = append(buffer, uid)
		last = user
	}
	res[last] = buffer
	return res, nil
}

func (s *LegacySQL) removeHistoryStar(ctx context.Context, user *user.User, stars []string) error {
	sql, err := s.db(ctx)
	if err != nil {
		return err
	}
	req := newStarQueryReq(sql, "", user.OrgID)
	req.UserID = user.ID
	if len(stars) > 0 {
		req.QueryUIDs = stars
	}

	q, err := sqltemplate.Execute(sqlHistoryStarsDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlHistoryStarsDelete.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	_, err = sess.Exec(ctx, q, req.GetArgs()...)
	return err
}

func (s *LegacySQL) addHistoryStar(ctx context.Context, user *user.User, star string) error {
	sql, err := s.db(ctx)
	if err != nil {
		return err
	}
	req := newStarQueryReq(sql, "", user.OrgID)
	req.UserID = user.ID
	req.QueryUID = star

	q, err := sqltemplate.Execute(sqlHistoryStarsDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlHistoryStarsDelete.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	_, err = sess.Exec(ctx, q, req.GetArgs()...)
	return err
}

// List all defined preferences in an org (valid for admin users only)
func (s *LegacySQL) listPreferences(ctx context.Context,
	ns string, orgId int64,
	cb func(req *preferencesQuery) (bool, error),
	access func(p *preferenceModel) bool,
) ([]preferences.Preferences, int64, error) {
	var results []preferences.Preferences
	var rv sql.NullTime
	var max sql.NullString

	sql, err := s.db(ctx)
	if err != nil {
		return nil, 0, err
	}

	req := newPreferencesQueryReq(sql, orgId)
	needsRV, err := cb(&req)
	if err != nil {
		return nil, 0, err
	}

	q, err := sqltemplate.Execute(sqlPreferencesQuery, req)
	if err != nil {
		return nil, 0, fmt.Errorf("execute template %q: %w", sqlPreferencesQuery.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	rows, err := sess.Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	for rows.Next() {
		// SELECT p.id, p.org_id,
		//   p.json_data,
		//   p.timezone,
		//   p.theme,
		//   p.week_start,
		//   p.home_dashboard_uid,
		//   u.uid as user_uid,
		//   t.uid as team_uid,
		//   p.created, p.updated

		pref := preferenceModel{}
		err := rows.Scan(&pref.ID, &pref.OrgID,
			&pref.JSONData,
			&pref.Timezone,
			&pref.Theme,
			&pref.WeekStart,
			&pref.HomeDashboardUID,
			&pref.UserUID, &pref.TeamUID,
			&pref.Created, &pref.Updated)
		if err != nil {
			return nil, 0, err
		}
		if pref.Updated.After(rv.Time) {
			rv.Time = pref.Updated
		}
		if !access(&pref) {
			continue // user does not have access
		}
		results = append(results, asPreferencesResource(ns, &pref))
	}

	if needsRV {
		req.Reset()
		q, err = sqltemplate.Execute(sqlPreferencesRV, req)
		if err != nil {
			return nil, 0, fmt.Errorf("execute template %q: %w", sqlPreferencesRV.Name(), err)
		}
		err = sess.Get(ctx, &max, q)
		if err != nil {
			return nil, 0, fmt.Errorf("unable to get RV %w", err)
		}
		if max.Valid && max.String != "" {
			t, _ := time.Parse(time.RFC3339, max.String)
			if !t.IsZero() {
				rv.Time = t
			}
		} else {
			rv.Time = s.startup
		}
	}
	return results, rv.Time.UnixMilli(), err
}

func (s *LegacySQL) ListPreferences(ctx context.Context, ns string, user identity.Requester, needsRV bool) (*preferences.PreferencesList, error) {
	if ns == "" {
		return nil, fmt.Errorf("namespace is required")
	}

	info, err := authlib.ParseNamespace(ns)
	if err != nil {
		return nil, err
	}

	// when the user is nil, it is actually admin and can see everything
	var teams []string
	found, rv, err := s.listPreferences(ctx, ns, info.OrgID,
		func(req *preferencesQuery) (bool, error) {
			if user != nil {
				req.UserUID = user.GetIdentifier()
				teams, err = s.GetTeams(ctx, &identity.StaticRequester{
					OrgID:   info.OrgID,
					UserUID: req.UserUID,
				}, false)
				req.UserTeams = teams
			}
			return needsRV, err
		},
		func(p *preferenceModel) bool {
			if user == nil || user.GetIsGrafanaAdmin() {
				return true
			}
			if p.UserUID.String != "" {
				return user.GetIdentifier() == p.UserUID.String
			}
			if p.TeamUID.String != "" {
				return slices.Contains(teams, p.TeamUID.String)
			}
			return true
		},
	)
	if err != nil {
		return nil, err
	}
	list := &preferences.PreferencesList{
		Items: found,
	}
	if rv > 0 {
		list.ResourceVersion = strconv.FormatInt(rv, 10)
	}
	return list, nil
}

func (s *LegacySQL) InTeam(ctx context.Context, id authlib.AuthInfo, team string, admin bool) (bool, error) {
	// Could be faster, but find for now
	teams, err := s.GetTeams(ctx, id, admin)
	if err != nil {
		return false, err
	}
	return slices.Contains(teams, team), nil
}

func (s *LegacySQL) GetTeams(ctx context.Context, id authlib.AuthInfo, admin bool) ([]string, error) {
	sql, err := s.db(ctx)
	if err != nil {
		return nil, err
	}

	xid, ok := id.(identity.Requester)
	if !ok {
		return nil, fmt.Errorf("expected identity.Requester")
	}
	req := newTeamsQueryReq(sql, xid.GetOrgID(), id.GetUID(), admin)

	q, err := sqltemplate.Execute(sqlTeams, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlTeams.Name(), err)
	}
	teams := []string{}
	sess := sql.DB.GetSqlxSession()
	err = sess.Select(ctx, &teams, q, req.GetArgs()...)
	return teams, err
}

func (s *LegacySQL) getLegacyTeamID(ctx context.Context, orgId int64, team string) (int64, error) {
	sql, err := s.db(ctx)
	if err != nil {
		return 0, err
	}

	var id int64
	sess := sql.DB.GetSqlxSession()
	err = sess.Select(ctx, &id, "SELECT id FROM team WHERE org_id=? AND uid=?", orgId, team)
	return id, err
}

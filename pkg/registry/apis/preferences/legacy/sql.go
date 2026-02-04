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
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

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

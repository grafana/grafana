package legacy

import (
	"context"
	"fmt"
	"text/template"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ LegacyIdentityStore = (*legacySQLStore)(nil)
)

type legacySQLStore struct {
	dialect sqltemplate.Dialect
	sql     legacysql.NamespacedDBProvider
	teamsRV legacysql.ResourceVersionLookup
	usersRV legacysql.ResourceVersionLookup
}

func NewLegacySQLStores(sql legacysql.NamespacedDBProvider) (LegacyIdentityStore, error) {
	db, err := sql(context.Background())
	if err != nil {
		return nil, err
	}
	dialect := sqltemplate.DialectForDriver(string(db.GetDBType()))
	if dialect == nil {
		return nil, fmt.Errorf("unknown dialect")
	}

	return &legacySQLStore{
		sql:     sql,
		dialect: dialect,
		teamsRV: legacysql.GetResourceVersionLookup(sql, "team", "updated"),
		usersRV: legacysql.GetResourceVersionLookup(sql, "user", "updated"),
	}, nil
}

// ListTeams implements LegacyIdentityStore.
func (s *legacySQLStore) ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error) {
	if query.Limit < 1 {
		query.Limit = 50
	}

	limit := int(query.Limit)
	query.Limit += 1 // for continue
	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	req := sqlQueryListTeams{
		SQLTemplate: sqltemplate.New(s.dialect),
		Query:       &query,
	}

	rawQuery, err := sqltemplate.Execute(sqlQueryTeams, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeams.Name(), err)
	}
	q := rawQuery

	// fmt.Printf("%s // %v\n", rawQuery, req.GetArgs())

	db, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	res := &ListTeamResult{}
	rows, err := db.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	if err == nil {
		// id, uid, name, email, created, updated
		var lastID int64
		for rows.Next() {
			t := team.Team{}
			err = rows.Scan(&t.ID, &t.UID, &t.Name, &t.Email, &t.Created, &t.Updated)
			if err != nil {
				return res, err
			}
			lastID = t.ID
			res.Teams = append(res.Teams, t)
			if len(res.Teams) > limit {
				res.ContinueID = lastID
				break
			}
		}
		if query.UID == "" {
			res.RV, err = s.teamsRV(ctx)
		}
	}
	return res, err
}

// ListUsers implements LegacyIdentityStore.
func (s *legacySQLStore) ListUsers(ctx context.Context, ns claims.NamespaceInfo, query ListUserQuery) (*ListUserResult, error) {
	if query.Limit < 1 {
		query.Limit = 50
	}

	limit := int(query.Limit)
	query.Limit += 1 // for continue
	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	return s.queryUsers(ctx, sqlQueryUsers, sqlQueryListUsers{
		SQLTemplate: sqltemplate.New(s.dialect),
		Query:       &query,
	}, limit, query.UID != "")
}

func (s *legacySQLStore) queryUsers(ctx context.Context, t *template.Template, req sqltemplate.Args, limit int, getRV bool) (*ListUserResult, error) {
	rawQuery, err := sqltemplate.Execute(t, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryUsers.Name(), err)
	}
	q := rawQuery

	// fmt.Printf("%s // %v\n", rawQuery, req.GetArgs())
	db, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	res := &ListUserResult{}
	rows, err := db.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	if err == nil {
		var lastID int64
		for rows.Next() {
			u := user.User{}
			err = rows.Scan(&u.OrgID, &u.ID, &u.UID, &u.Login, &u.Email, &u.Name,
				&u.Created, &u.Updated, &u.IsServiceAccount, &u.IsDisabled, &u.IsAdmin,
			)
			if err != nil {
				return res, err
			}
			lastID = u.ID
			res.Users = append(res.Users, u)
			if len(res.Users) > limit {
				res.ContinueID = lastID
				break
			}
		}
		if getRV {
			res.RV, err = s.usersRV(ctx)
		}
	}
	return res, err
}

// GetUserTeams implements LegacyIdentityStore.
func (s *legacySQLStore) GetUserTeams(ctx context.Context, ns claims.NamespaceInfo, uid string) ([]team.Team, error) {
	panic("unimplemented")
}

// GetDisplay implements LegacyIdentityStore.
func (s *legacySQLStore) GetDisplay(ctx context.Context, ns claims.NamespaceInfo, query GetUserDisplayQuery) (*ListUserResult, error) {
	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	return s.queryUsers(ctx, sqlQueryDisplay, sqlQueryGetDisplay{
		SQLTemplate: sqltemplate.New(s.dialect),
		Query:       &query,
	}, 10000, false)
}

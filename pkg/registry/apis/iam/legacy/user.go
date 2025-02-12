package legacy

import (
	"context"
	"errors"
	"fmt"
	"text/template"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type GetUserInternalIDQuery struct {
	OrgID int64
	UID   string
}

type GetUserInternalIDResult struct {
	ID int64
}

var sqlQueryUserInternalIDTemplate = mustTemplate("user_internal_id.sql")

func newGetUserInternalID(sql *legacysql.LegacyDatabaseHelper, q *GetUserInternalIDQuery) getUserInternalIDQuery {
	return getUserInternalIDQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Query:        q,
	}
}

type getUserInternalIDQuery struct {
	sqltemplate.SQLTemplate
	UserTable    string
	OrgUserTable string
	Query        *GetUserInternalIDQuery
}

func (r getUserInternalIDQuery) Validate() error {
	return nil // TODO
}

func (s *legacySQLStore) GetUserInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetUserInternalIDQuery) (*GetUserInternalIDResult, error) {
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newGetUserInternalID(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryUserInternalIDTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryUserInternalIDTemplate.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	if err != nil {
		return nil, err
	}

	if !rows.Next() {
		return nil, errors.New("user not found")
	}

	var id int64
	if err := rows.Scan(&id); err != nil {
		return nil, err
	}

	return &GetUserInternalIDResult{
		id,
	}, nil
}

type ListUserQuery struct {
	OrgID int64
	UID   string

	Pagination common.Pagination
}

type ListUserResult struct {
	Users    []user.User
	Continue int64
	RV       int64
}

var sqlQueryUsersTemplate = mustTemplate("users_query.sql")

func newListUser(sql *legacysql.LegacyDatabaseHelper, q *ListUserQuery) listUsersQuery {
	return listUsersQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Query:        q,
	}
}

type listUsersQuery struct {
	sqltemplate.SQLTemplate
	Query        *ListUserQuery
	UserTable    string
	OrgUserTable string
}

func (r listUsersQuery) Validate() error {
	return nil // TODO
}

// ListUsers implements LegacyIdentityStore.
func (s *legacySQLStore) ListUsers(ctx context.Context, ns claims.NamespaceInfo, query ListUserQuery) (*ListUserResult, error) {
	// for continue
	limit := int(query.Pagination.Limit)
	query.Pagination.Limit += 1

	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	res, err := s.queryUsers(ctx, sql, sqlQueryUsersTemplate, newListUser(sql, &query), limit)
	if err == nil && query.UID != "" {
		res.RV, err = sql.GetResourceVersion(ctx, "user", "updated")
	}

	return res, err
}

func (s *legacySQLStore) queryUsers(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, t *template.Template, req sqltemplate.Args, limit int) (*ListUserResult, error) {
	q, err := sqltemplate.Execute(t, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", t.Name(), err)
	}

	res := &ListUserResult{}
	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
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
				res.Users = res.Users[0 : len(res.Users)-1]
				res.Continue = lastID
				break
			}
		}
	}

	return res, err
}

type ListUserTeamsQuery struct {
	UserUID    string
	OrgID      int64
	Pagination common.Pagination
}

type ListUserTeamsResult struct {
	Continue int64
	Items    []UserTeam
}

type UserTeam struct {
	ID         int64
	UID        string
	Name       string
	Permission team.PermissionType
}

var sqlQueryUserTeamsTemplate = mustTemplate("user_teams_query.sql")

func newListUserTeams(sql *legacysql.LegacyDatabaseHelper, q *ListUserTeamsQuery) listUserTeamsQuery {
	return listUserTeamsQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		UserTable:       sql.Table("user"),
		TeamTable:       sql.Table("team"),
		TeamMemberTable: sql.Table("team_member"),
		Query:           q,
	}
}

type listUserTeamsQuery struct {
	sqltemplate.SQLTemplate
	Query           *ListUserTeamsQuery
	UserTable       string
	TeamTable       string
	TeamMemberTable string
}

func (r listUserTeamsQuery) Validate() error {
	return nil
}

func (s *legacySQLStore) ListUserTeams(ctx context.Context, ns claims.NamespaceInfo, query ListUserTeamsQuery) (*ListUserTeamsResult, error) {
	query.Pagination.Limit += 1
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newListUserTeams(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryUserTeamsTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeamsTemplate.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	if err != nil {
		return nil, err
	}

	res := &ListUserTeamsResult{}
	var lastID int64
	for rows.Next() {
		t := UserTeam{}
		err := rows.Scan(&t.ID, &t.UID, &t.Name, &t.Permission)
		if err != nil {
			return nil, err
		}

		lastID = t.ID
		res.Items = append(res.Items, t)
		if len(res.Items) > int(query.Pagination.Limit)-1 {
			res.Continue = lastID
			res.Items = res.Items[0 : len(res.Items)-1]
			break
		}
	}

	return res, err
}

package legacy

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"text/template"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util"
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
				&u.Created, &u.Updated, &u.IsServiceAccount, &u.IsDisabled, &u.IsAdmin, &u.EmailVerified,
				&u.IsProvisioned, &u.LastSeenAt,
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

		// regression: team_member.permission has been nulled in some instances
		// Team memberships created before the permission column was added will have a NULL value
		var nullablePermission *int64
		err := rows.Scan(&t.ID, &t.UID, &t.Name, &nullablePermission)
		if err != nil {
			return nil, err
		}

		if nullablePermission != nil {
			t.Permission = team.PermissionType(*nullablePermission)
		} else {
			// treat NULL as member permission
			t.Permission = team.PermissionType(0)
		}

		res.Items = append(res.Items, t)
		lastID = t.ID
		if len(res.Items) > int(query.Pagination.Limit)-1 {
			res.Continue = lastID
			res.Items = res.Items[0 : len(res.Items)-1]
			break
		}
	}

	return res, err
}

type CreateUserCommand struct {
	UID           string
	Email         string
	Login         string
	Name          string
	OrgID         int64
	IsAdmin       bool
	IsDisabled    bool
	EmailVerified bool
	IsProvisioned bool
	Salt          string
	Rands         string
	Created       time.Time
	Updated       time.Time
	LastSeenAt    time.Time
	Role          string
}

type CreateUserResult struct {
	User user.User
}

type DeleteUserCommand struct {
	UID string
}

type DeleteUserResult struct {
	Success bool
}

var sqlCreateUserTemplate = mustTemplate("create_user.sql")
var sqlCreateOrgUserTemplate = mustTemplate("create_org_user.sql")
var sqlDeleteUserTemplate = mustTemplate("delete_user.sql")
var sqlDeleteOrgUserTemplate = mustTemplate("delete_org_user.sql")

func newCreateUser(sql *legacysql.LegacyDatabaseHelper, cmd *CreateUserCommand) createUserQuery {
	return createUserQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Command:      cmd,
	}
}

type createUserQuery struct {
	sqltemplate.SQLTemplate
	UserTable    string
	OrgUserTable string
	Command      *CreateUserCommand
}

func (r createUserQuery) Validate() error {
	if r.Command.Login == "" && r.Command.Email == "" {
		return fmt.Errorf("user must have either login or email")
	}
	if r.Command.OrgID == 0 {
		return fmt.Errorf("org ID is required")
	}
	return nil
}

type createOrgUserQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable string
	Command      *CreateUserCommand
	UserID       int64
}

// CreateUser implements LegacyIdentityStore.
func (s *legacySQLStore) CreateUser(ctx context.Context, ns claims.NamespaceInfo, cmd CreateUserCommand) (*CreateUserResult, error) {
	cmd.OrgID = ns.OrgID
	if cmd.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	// Generate UID if not provided
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	}

	// Normalize login and email
	cmd.Login = strings.ToLower(cmd.Login)
	cmd.Email = strings.ToLower(cmd.Email)

	// If login is empty, use email
	if cmd.Login == "" {
		cmd.Login = cmd.Email
	}
	// If email is empty, use login
	if cmd.Email == "" {
		cmd.Email = cmd.Login
	}

	// Generate salt and rands
	salt, err := util.GetRandomString(10)
	if err != nil {
		return nil, err
	}
	rands, err := util.GetRandomString(10)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	lastSeenAt := now.AddDate(-10, 0, 0) // Set last seen 10 years ago like in user service

	// Set additional fields
	cmd.Salt = salt
	cmd.Rands = rands
	cmd.Created = now
	cmd.Updated = now
	cmd.LastSeenAt = lastSeenAt
	cmd.Role = "Viewer" // Default role

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newCreateUser(sql, &cmd)
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Execute in transaction
	var createdUser user.User
	err = sql.DB.InTransaction(ctx, func(ctx context.Context) error {
		// First, create the user
		userQuery, err := sqltemplate.Execute(sqlCreateUserTemplate, req)
		if err != nil {
			return fmt.Errorf("execute user template %q: %w", sqlCreateUserTemplate.Name(), err)
		}

		result, err := sql.DB.GetSqlxSession().Exec(ctx, userQuery, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to create user: %w", err)
		}

		userID, err := result.LastInsertId()
		if err != nil {
			return fmt.Errorf("failed to get user ID: %w", err)
		}

		// Now create the org_user relationship using a separate template
		orgUserReq := createOrgUserQuery{
			SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
			OrgUserTable: sql.Table("org_user"),
			Command:      &cmd,
			UserID:       userID,
		}

		orgUserQuery, err := sqltemplate.Execute(sqlCreateOrgUserTemplate, orgUserReq)
		if err != nil {
			return fmt.Errorf("execute org_user template %q: %w", sqlCreateOrgUserTemplate.Name(), err)
		}

		_, err = sql.DB.GetSqlxSession().Exec(ctx, orgUserQuery, orgUserReq.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to create org_user relationship: %w", err)
		}

		// Set the created user data
		createdUser = user.User{
			ID:               userID,
			UID:              cmd.UID,
			Login:            cmd.Login,
			Email:            cmd.Email,
			Name:             cmd.Name,
			OrgID:            cmd.OrgID,
			IsAdmin:          cmd.IsAdmin,
			IsDisabled:       cmd.IsDisabled,
			EmailVerified:    cmd.EmailVerified,
			IsProvisioned:    cmd.IsProvisioned,
			Salt:             cmd.Salt,
			Rands:            cmd.Rands,
			Created:          cmd.Created,
			Updated:          cmd.Updated,
			LastSeenAt:       cmd.LastSeenAt,
			IsServiceAccount: false,
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &CreateUserResult{User: createdUser}, nil
}

func newDeleteUser(sql *legacysql.LegacyDatabaseHelper, cmd *DeleteUserCommand) deleteUserQuery {
	return deleteUserQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Command:      cmd,
	}
}

type deleteUserQuery struct {
	sqltemplate.SQLTemplate
	UserTable    string
	OrgUserTable string
	Command      *DeleteUserCommand
	OrgID        int64
}

type deleteOrgUserQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable string
	UserID       int64
}

func (r deleteUserQuery) Validate() error {
	if r.Command.UID == "" {
		return fmt.Errorf("user UID is required")
	}
	if r.OrgID == 0 {
		return fmt.Errorf("org ID is required")
	}
	return nil
}

// DeleteUser implements LegacyIdentityStore.
func (s *legacySQLStore) DeleteUser(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteUserCommand) (*DeleteUserResult, error) {
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	if cmd.UID == "" {
		return nil, fmt.Errorf("user UID is required")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newDeleteUser(sql, &cmd)
	req.OrgID = ns.OrgID
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Execute in a transaction with separate operations to avoid locking issues
	err = sql.DB.InTransaction(ctx, func(ctx context.Context) error {
		// First, get the user ID to use for org_user deletion
		userLookupReq := newGetUserInternalID(sql, &GetUserInternalIDQuery{
			OrgID: ns.OrgID,
			UID:   cmd.UID,
		})

		userQuery, err := sqltemplate.Execute(sqlQueryUserInternalIDTemplate, userLookupReq)
		if err != nil {
			return fmt.Errorf("execute user lookup template: %w", err)
		}

		rows, err := sql.DB.GetSqlxSession().Query(ctx, userQuery, userLookupReq.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to check if user exists: %w", err)
		}
		defer rows.Close()

		var userID int64
		if !rows.Next() {
			return fmt.Errorf("user not found")
		}
		if err := rows.Scan(&userID); err != nil {
			return fmt.Errorf("failed to scan user ID: %w", err)
		}
		rows.Close()

		// Delete from org_user table first using the template
		orgUserReq := deleteOrgUserQuery{
			SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
			OrgUserTable: sql.Table("org_user"),
			UserID:       userID,
		}

		orgUserDeleteQuery, err := sqltemplate.Execute(sqlDeleteOrgUserTemplate, orgUserReq)
		if err != nil {
			return fmt.Errorf("execute org_user delete template: %w", err)
		}

		_, err = sql.DB.GetSqlxSession().Exec(ctx, orgUserDeleteQuery, orgUserReq.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to delete from org_user: %w", err)
		}

		// Now delete the user using the SQL template
		deleteQuery, err := sqltemplate.Execute(sqlDeleteUserTemplate, req)
		if err != nil {
			return fmt.Errorf("execute delete template %q: %w", sqlDeleteUserTemplate.Name(), err)
		}

		result, err := sql.DB.GetSqlxSession().Exec(ctx, deleteQuery, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to delete user: %w", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("failed to get rows affected: %w", err)
		}

		if rowsAffected == 0 {
			return fmt.Errorf("user not found")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &DeleteUserResult{Success: true}, nil
}

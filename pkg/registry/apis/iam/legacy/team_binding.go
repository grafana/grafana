package legacy

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type ListTeamBindingsQuery struct {
	UID        string
	OrgID      int64
	TeamUID    string
	UserUID    string
	External   *bool
	Pagination common.Pagination
}

type ListTeamBindingsResult struct {
	Bindings []TeamMember
	Continue int64
	RV       int64
}

type TeamMember struct {
	ID         int64
	UID        string
	TeamID     int64
	TeamUID    string
	UserID     int64
	UserUID    string
	OrgID      int64
	Name       string
	Email      string
	Username   string
	External   bool
	Updated    time.Time
	Created    time.Time
	Permission team.PermissionType
}

func (m TeamMember) MemberID() string {
	return claims.NewTypeID(claims.TypeUser, m.UserUID)
}

var sqlQueryTeamBindingsTemplate = mustTemplate("team_bindings_query.sql")

type listTeamBindingsQuery struct {
	sqltemplate.SQLTemplate
	Query           *ListTeamBindingsQuery
	UserTable       string
	TeamTable       string
	TeamMemberTable string
}

func (r listTeamBindingsQuery) Validate() error {
	return nil // TODO
}

func (r listTeamBindingsQuery) ExternalValue() bool {
	if r.Query.External != nil {
		return *r.Query.External
	}
	return false
}

func newListTeamBindings(sql *legacysql.LegacyDatabaseHelper, q *ListTeamBindingsQuery) listTeamBindingsQuery {
	return listTeamBindingsQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		UserTable:       sql.Table("user"),
		TeamTable:       sql.Table("team"),
		TeamMemberTable: sql.Table("team_member"),
		Query:           q,
	}
}

func (s *legacySQLStore) ListTeamBindings(ctx context.Context, ns claims.NamespaceInfo, query ListTeamBindingsQuery) (*ListTeamBindingsResult, error) {
	// for continue
	query.Pagination.Limit += 1
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newListTeamBindings(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryTeamBindingsTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeamBindingsTemplate.Name(), err)
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

	res := &ListTeamBindingsResult{
		Bindings: make([]TeamMember, 0, int(query.Pagination.Limit)),
	}

	var lastID int64

	for rows.Next() {
		m := TeamMember{}
		err = rows.Scan(&m.ID, &m.UID, &m.TeamUID, &m.TeamID, &m.UserUID, &m.UserID, &m.Created, &m.Updated, &m.Permission, &m.External)
		if err != nil {
			return res, err
		}

		res.Bindings = append(res.Bindings, m)

		lastID = m.ID

		if len(res.Bindings) >= int(query.Pagination.Limit)-1 {
			res.Continue = lastID
			break
		}
	}

	return res, err
}

type CreateTeamMemberCommand struct {
	UID        string
	TeamID     int64
	TeamUID    string
	UserID     int64
	UserUID    string
	OrgID      int64
	Created    legacysql.DBTime
	Updated    legacysql.DBTime
	External   bool
	Permission team.PermissionType
}

type CreateTeamMemberResult struct {
	TeamMember TeamMember
}

var sqlCreateTeamMemberQuery = mustTemplate("create_team_member_query.sql")

func newCreateTeamMember(sql *legacysql.LegacyDatabaseHelper, cmd *CreateTeamMemberCommand) createTeamMemberQuery {
	return createTeamMemberQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		TeamMemberTable: sql.Table("team_member"),
		Command:         cmd,
	}
}

type createTeamMemberQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	Command         *CreateTeamMemberCommand
}

func (r createTeamMemberQuery) Validate() error {
	return nil
}

func (s *legacySQLStore) CreateTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd CreateTeamMemberCommand) (*CreateTeamMemberResult, error) {
	now := time.Now().UTC()
	cmd.Created = legacysql.NewDBTime(now)
	cmd.Updated = legacysql.NewDBTime(now)
	cmd.OrgID = ns.OrgID

	if cmd.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newCreateTeamMember(sql, &cmd)

	var createdTeamMember TeamMember
	err = sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		teamMemberQuery, err := sqltemplate.Execute(sqlCreateTeamMemberQuery, req)
		if err != nil {
			return fmt.Errorf("failed to execute team member template %q: %w", sqlCreateTeamMemberQuery.Name(), err)
		}

		teamMemberID, err := st.ExecWithReturningId(ctx, teamMemberQuery, req.GetArgs()...)
		if err != nil {
			if sql.DB.GetDialect().IsUniqueConstraintViolation(err) {
				return team.ErrTeamMemberAlreadyAdded
			}
			return fmt.Errorf("failed to create team member: %w", err)
		}

		createdTeamMember = TeamMember{
			ID:         teamMemberID,
			UID:        cmd.UID,
			TeamID:     cmd.TeamID,
			TeamUID:    cmd.TeamUID,
			UserID:     cmd.UserID,
			UserUID:    cmd.UserUID,
			OrgID:      cmd.OrgID,
			Created:    cmd.Created.Time,
			Updated:    cmd.Updated.Time,
			External:   cmd.External,
			Permission: cmd.Permission,
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &CreateTeamMemberResult{TeamMember: createdTeamMember}, nil
}

type ListTeamMembersQuery struct {
	UID        string
	OrgID      int64
	Pagination common.Pagination
}

type ListTeamMembersResult struct {
	Continue int64
	Members  []TeamMember
}

var sqlQueryTeamMembersTemplate = mustTemplate("team_members_query.sql")

type listTeamMembersQuery struct {
	sqltemplate.SQLTemplate
	Query           *ListTeamMembersQuery
	UserTable       string
	TeamTable       string
	TeamMemberTable string
}

func (r listTeamMembersQuery) Validate() error {
	return nil // TODO
}

func newListTeamMembers(sql *legacysql.LegacyDatabaseHelper, q *ListTeamMembersQuery) listTeamMembersQuery {
	return listTeamMembersQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		UserTable:       sql.Table("user"),
		TeamTable:       sql.Table("team"),
		TeamMemberTable: sql.Table("team_member"),
		Query:           q,
	}
}

func (s *legacySQLStore) ListTeamMembers(ctx context.Context, ns claims.NamespaceInfo, query ListTeamMembersQuery) (*ListTeamMembersResult, error) {
	query.Pagination.Limit += 1
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newListTeamMembers(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryTeamMembersTemplate, req)
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

	res := &ListTeamMembersResult{}
	var lastID int64
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, err
		}

		lastID = m.ID
		res.Members = append(res.Members, m)

		if int64(len(res.Members)) > query.Pagination.Limit-1 {
			res.Continue = lastID
			res.Members = res.Members[0 : len(res.Members)-1]
			break
		}
	}

	return res, err
}

type UpdateTeamMemberCommand struct {
	UID        string
	Permission team.PermissionType
	Updated    legacysql.DBTime
}

type UpdateTeamMemberResult struct {
	UID        string
	Permission team.PermissionType
	Updated    legacysql.DBTime
}

var sqlUpdateTeamMemberQuery = mustTemplate("update_team_member_query.sql")

func newUpdateTeamMember(sql *legacysql.LegacyDatabaseHelper, cmd *UpdateTeamMemberCommand) updateTeamMemberQuery {
	return updateTeamMemberQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		TeamMemberTable: sql.Table("team_member"),
		Command:         cmd,
	}
}

type updateTeamMemberQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	Command         *UpdateTeamMemberCommand
}

func (r updateTeamMemberQuery) Validate() error {
	return nil
}

func (s *legacySQLStore) UpdateTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateTeamMemberCommand) (*UpdateTeamMemberResult, error) {
	now := time.Now().UTC()
	cmd.Updated = legacysql.NewDBTime(now)

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newUpdateTeamMember(sql, &cmd)

	var result UpdateTeamMemberResult
	err = sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		teamMemberQuery, err := sqltemplate.Execute(sqlUpdateTeamMemberQuery, req)
		if err != nil {
			return fmt.Errorf("failed to execute team member template %q: %w", sqlUpdateTeamMemberQuery.Name(), err)
		}

		_, err = st.Exec(ctx, teamMemberQuery, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to update team member: %w", err)
		}

		result = UpdateTeamMemberResult(cmd)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &result, nil
}

type DeleteTeamMemberCommand struct {
	UID string
}

var sqlDeleteTeamMemberQuery = mustTemplate("delete_team_member_query.sql")

func newDeleteTeamMember(sql *legacysql.LegacyDatabaseHelper, cmd *DeleteTeamMemberCommand) deleteTeamMemberQuery {
	return deleteTeamMemberQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		TeamMemberTable: sql.Table("team_member"),
		Command:         cmd,
	}
}

type deleteTeamMemberQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	Command         *DeleteTeamMemberCommand
}

func (r deleteTeamMemberQuery) Validate() error {
	return nil
}

func (s *legacySQLStore) DeleteTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteTeamMemberCommand) error {
	sql, err := s.sql(ctx)
	if err != nil {
		return err
	}
	req := newDeleteTeamMember(sql, &cmd)
	if err := req.Validate(); err != nil {
		return err
	}

	err = sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		teamMemberQuery, err := sqltemplate.Execute(sqlDeleteTeamMemberQuery, req)
		if err != nil {
			return fmt.Errorf("failed to execute team member template %q: %w", sqlDeleteTeamMemberQuery.Name(), err)
		}

		_, err = st.Exec(ctx, teamMemberQuery, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to delete team member: %w", err)
		}

		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func scanMember(rows *sql.Rows) (TeamMember, error) {
	m := TeamMember{}
	err := rows.Scan(&m.ID, &m.UID, &m.TeamUID, &m.TeamID, &m.UserUID, &m.UserID, &m.Name, &m.Email, &m.Username, &m.External, &m.Created, &m.Updated, &m.Permission)
	return m, err
}

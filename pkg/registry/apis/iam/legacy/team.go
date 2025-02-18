package legacy

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type GetTeamInternalIDQuery struct {
	OrgID int64
	UID   string
}

type GetTeamInternalIDResult struct {
	ID int64
}

var sqlQueryTeamInternalIDTemplate = mustTemplate("team_internal_id.sql")

func newGetTeamInternalID(sql *legacysql.LegacyDatabaseHelper, q *GetTeamInternalIDQuery) getTeamInternalIDQuery {
	return getTeamInternalIDQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TeamTable:   sql.Table("team"),
		Query:       q,
	}
}

type getTeamInternalIDQuery struct {
	sqltemplate.SQLTemplate
	TeamTable string
	Query     *GetTeamInternalIDQuery
}

func (r getTeamInternalIDQuery) Validate() error { return nil }

func (s *legacySQLStore) GetTeamInternalID(
	ctx context.Context,
	ns claims.NamespaceInfo,
	query GetTeamInternalIDQuery,
) (*GetTeamInternalIDResult, error) {
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newGetTeamInternalID(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryTeamInternalIDTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeamInternalIDTemplate.Name(), err)
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
		return nil, errors.New("team not found")
	}

	var id int64
	if err := rows.Scan(&id); err != nil {
		return nil, err
	}

	return &GetTeamInternalIDResult{
		id,
	}, nil
}

type ListTeamQuery struct {
	OrgID int64
	UID   string

	Pagination common.Pagination
}

type ListTeamResult struct {
	Teams    []team.Team
	Continue int64
	RV       int64
}

var sqlQueryTeamsTemplate = mustTemplate("teams_query.sql")

type listTeamsQuery struct {
	sqltemplate.SQLTemplate
	Query     *ListTeamQuery
	TeamTable string
}

func newListTeams(sql *legacysql.LegacyDatabaseHelper, q *ListTeamQuery) listTeamsQuery {
	return listTeamsQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TeamTable:   sql.Table("team"),
		Query:       q,
	}
}

func (r listTeamsQuery) Validate() error {
	return nil // TODO
}

// ListTeams implements LegacyIdentityStore.
func (s *legacySQLStore) ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error) {
	// for continue
	query.Pagination.Limit += 1
	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newListTeams(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryTeamsTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeamsTemplate.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	res := &ListTeamResult{}
	if err != nil {
		return nil, err
	}

	var lastID int64
	for rows.Next() {
		t := team.Team{}
		err = rows.Scan(&t.ID, &t.UID, &t.Name, &t.Email, &t.Created, &t.Updated)
		if err != nil {
			return res, err
		}

		lastID = t.ID
		res.Teams = append(res.Teams, t)
		if len(res.Teams) > int(query.Pagination.Limit)-1 {
			res.Teams = res.Teams[0 : len(res.Teams)-1]
			res.Continue = lastID
			break
		}
	}

	if query.UID == "" {
		res.RV, err = sql.GetResourceVersion(ctx, "team", "updated")
	}

	return res, err
}

type ListTeamBindingsQuery struct {
	// UID is team uid to list bindings for. If not set store should list bindings for all teams
	UID        string
	OrgID      int64
	Pagination common.Pagination
}

type ListTeamBindingsResult struct {
	Bindings []TeamBinding
	Continue int64
	RV       int64
}

type TeamMember struct {
	ID         int64
	TeamID     int64
	TeamUID    string
	UserID     int64
	UserUID    string
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

type TeamBinding struct {
	TeamUID string
	Members []TeamMember
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

func newListTeamBindings(sql *legacysql.LegacyDatabaseHelper, q *ListTeamBindingsQuery) listTeamBindingsQuery {
	return listTeamBindingsQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		UserTable:       sql.Table("user"),
		TeamTable:       sql.Table("team"),
		TeamMemberTable: sql.Table("team_member"),
		Query:           q,
	}
}

// ListTeamsBindings implements LegacyIdentityStore.
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

	res := &ListTeamBindingsResult{}
	grouped := map[string][]TeamMember{}

	var lastID int64
	var atTeamLimit bool

	for rows.Next() {
		m := TeamMember{}
		err = rows.Scan(&m.ID, &m.TeamUID, &m.TeamID, &m.UserUID, &m.Created, &m.Updated, &m.Permission)
		if err != nil {
			return res, err
		}

		lastID = m.TeamID
		members, ok := grouped[m.TeamUID]
		if ok {
			grouped[m.TeamUID] = append(members, m)
		} else if !atTeamLimit {
			grouped[m.TeamUID] = []TeamMember{m}
		}

		if len(grouped) >= int(query.Pagination.Limit)-1 {
			atTeamLimit = true
			res.Continue = lastID
		}
	}

	if query.UID == "" {
		res.RV, err = sql.GetResourceVersion(ctx, "team_member", "updated")
	}

	res.Bindings = make([]TeamBinding, 0, len(grouped))
	for uid, members := range grouped {
		res.Bindings = append(res.Bindings, TeamBinding{
			TeamUID: uid,
			Members: members,
		})
	}

	return res, err
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

// Templates.
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

// ListTeamMembers implements LegacyIdentityStore.
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
		if len(res.Members) > int(query.Pagination.Limit)-1 {
			res.Continue = lastID
			res.Members = res.Members[0 : len(res.Members)-1]
			break
		}
	}

	return res, err
}

func scanMember(rows *sql.Rows) (TeamMember, error) {
	m := TeamMember{}
	err := rows.Scan(&m.ID, &m.TeamUID, &m.TeamID, &m.UserUID, &m.UserID, &m.Name, &m.Email, &m.Username, &m.External, &m.Created, &m.Updated, &m.Permission)
	return m, err
}

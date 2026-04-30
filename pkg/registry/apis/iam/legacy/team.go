package legacy

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	claims "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type GetTeamUIDByIDQuery struct {
	OrgID int64
	ID    int64
}

type GetTeamUIDByIDResult struct {
	UID string
}

var sqlQueryTeamUIDByIDTemplate = mustTemplate("team_uid_by_id.sql")

func newGetTeamUIDByID(sqlHelper *legacysql.LegacyDatabaseHelper, q *GetTeamUIDByIDQuery) getTeamUIDByIDQuery {
	return getTeamUIDByIDQuery{
		SQLTemplate: sqltemplate.New(sqlHelper.DialectForDriver()),
		TeamTable:   sqlHelper.Table("team"),
		Query:       q,
	}
}

type getTeamUIDByIDQuery struct {
	sqltemplate.SQLTemplate
	TeamTable string
	Query     *GetTeamUIDByIDQuery
}

func (r getTeamUIDByIDQuery) Validate() error { return nil }

func (s *legacySQLStore) GetTeamUIDByID(
	ctx context.Context,
	ns claims.NamespaceInfo,
	query GetTeamUIDByIDQuery,
) (*GetTeamUIDByIDResult, error) {
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sqlConn, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newGetTeamUIDByID(sqlConn, &query)
	q, err := sqltemplate.Execute(sqlQueryTeamUIDByIDTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeamUIDByIDTemplate.Name(), err)
	}

	rows, err := sqlConn.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	if !rows.Next() {
		return nil, team.ErrTeamNotFound
	}

	var uid string
	if err := rows.Scan(&uid); err != nil {
		return nil, err
	}

	return &GetTeamUIDByIDResult{UID: uid}, nil
}

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

	sql, err := s.getDB(ctx)
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
		return nil, fmt.Errorf("team by uid %q: %w", query.UID, team.ErrTeamNotFound)
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
	ID    int64

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
	if query.Pagination.Limit < 1 {
		query.Pagination.Limit = common.DefaultListLimit
	}
	// for continue
	query.Pagination.Limit += 1
	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	sqlConn, err := s.getDB(ctx)
	if err != nil {
		return nil, err
	}

	req := newListTeams(sqlConn, &query)
	q, err := sqltemplate.Execute(sqlQueryTeamsTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryTeamsTemplate.Name(), err)
	}

	rows, err := sqlConn.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
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
		var externalUID sql.NullString
		var email sql.NullString
		var isProvisioned sql.NullBool
		err = rows.Scan(&t.ID, &t.UID, &t.Name, &email, &externalUID, &isProvisioned, &t.Created, &t.Updated)
		if err != nil {
			return res, err
		}

		if email.Valid {
			t.Email = email.String
		}

		if externalUID.Valid {
			t.ExternalUID = externalUID.String
		}

		if isProvisioned.Valid {
			t.IsProvisioned = isProvisioned.Bool
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
		res.RV, err = sqlConn.GetResourceVersion(ctx, "team", "updated")
	}

	return res, err
}

type CreateTeamCommand struct {
	UID           string
	Name          string
	OrgID         int64
	Created       legacysql.DBTime
	Updated       legacysql.DBTime
	Email         string
	ExternalID    string
	IsProvisioned bool
	ExternalUID   string

	// MemberCreates optionally seeds members alongside the team in the same
	// SQL transaction as the team row insert. Only UserID needs to be
	// pre-resolved by the caller; TeamID, TeamUID, OrgID and timestamps are
	// populated here from the team row that was just inserted, so if the
	// team insert rolls back the member inserts roll back with it.
	MemberCreates []CreateTeamMemberCommand

	// ExternalGroupReconciler, when non-nil, reconciles team_group rows
	// against DesiredExternalGroups inside the same SQL transaction as the
	// team row insert.
	ExternalGroupReconciler ExternalGroupReconciler
	DesiredExternalGroups   []string
}

type CreateTeamResult struct {
	Team team.Team
}

var sqlCreateTeamTemplate = mustTemplate("create_team.sql")

func newCreateTeam(sql *legacysql.LegacyDatabaseHelper, cmd *CreateTeamCommand) createTeamQuery {
	return createTeamQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TeamTable:   sql.Table("team"),
		Command:     cmd,
	}
}

type createTeamQuery struct {
	sqltemplate.SQLTemplate
	TeamTable string
	Command   *CreateTeamCommand
}

func (r createTeamQuery) Validate() error {
	return nil
}

func (s *legacySQLStore) CreateTeam(ctx context.Context, ns claims.NamespaceInfo, cmd CreateTeamCommand) (*CreateTeamResult, error) {
	now := time.Now().UTC()

	cmd.Created = legacysql.NewDBTime(now)
	cmd.Updated = legacysql.NewDBTime(now)
	cmd.OrgID = ns.OrgID

	if cmd.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.getDB(ctx)
	if err != nil {
		return nil, err
	}

	req := newCreateTeam(sql, &cmd)

	var createdTeam team.Team
	err = sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		teamQuery, err := sqltemplate.Execute(sqlCreateTeamTemplate, req)
		if err != nil {
			return fmt.Errorf("failed to execute team template %q: %w", sqlCreateTeamTemplate.Name(), err)
		}

		teamID, err := st.ExecWithReturningId(ctx, teamQuery, req.GetArgs()...)
		if err != nil {
			if sql.DB.GetDialect().IsUniqueConstraintViolation(err) {
				return apierrors.NewAlreadyExists(iamv0.TeamResourceInfo.GroupResource(), cmd.UID)
			}
			return fmt.Errorf("failed to create team: %w", err)
		}

		if len(cmd.MemberCreates) > 0 {
			for i := range cmd.MemberCreates {
				cmd.MemberCreates[i].TeamID = teamID
				cmd.MemberCreates[i].TeamUID = cmd.UID
				cmd.MemberCreates[i].OrgID = ns.OrgID
				cmd.MemberCreates[i].Created = legacysql.NewDBTime(now)
				cmd.MemberCreates[i].Updated = legacysql.NewDBTime(now)
			}
			bulk := CreateTeamMembersBulkCommand{Members: cmd.MemberCreates}
			breq := newCreateTeamMembersBulk(sql, &bulk)
			bq, err := sqltemplate.Execute(sqlCreateTeamMembersBulkQuery, breq)
			if err != nil {
				return fmt.Errorf("failed to execute bulk create team members template: %w", err)
			}
			if _, err := st.Exec(ctx, bq, breq.GetArgs()...); err != nil {
				if sql.DB.GetDialect().IsUniqueConstraintViolation(err) {
					return team.ErrTeamMemberAlreadyAdded
				}
				return fmt.Errorf("failed to create team members: %w", err)
			}
		}

		if cmd.ExternalGroupReconciler != nil {
			if err := cmd.ExternalGroupReconciler.Reconcile(ctx, st, ns.OrgID, teamID, cmd.DesiredExternalGroups); err != nil {
				return fmt.Errorf("failed to reconcile team external groups: %w", err)
			}
		}

		createdTeam = team.Team{
			ID:            teamID,
			UID:           cmd.UID,
			Name:          cmd.Name,
			OrgID:         cmd.OrgID,
			Email:         cmd.Email,
			ExternalUID:   cmd.ExternalUID,
			IsProvisioned: cmd.IsProvisioned,
			Created:       cmd.Created.Time,
			Updated:       cmd.Updated.Time,
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &CreateTeamResult{Team: createdTeam}, nil
}

type UpdateTeamCommand struct {
	UID           string
	Name          string
	Updated       legacysql.DBTime
	Email         string
	ExternalID    string
	IsProvisioned bool
	ExternalUID   string

	// MemberDeletes / MemberUpdates / MemberCreates reconcile the team's
	// members in the same SQL transaction as the team row update. Callers
	// must pre-resolve both TeamID and UserID on MemberCreates entries;
	// OrgID and timestamps are filled in here.
	MemberDeletes []DeleteTeamMemberCommand
	MemberUpdates []UpdateTeamMemberCommand
	MemberCreates []CreateTeamMemberCommand

	// ExternalGroupReconciler, when non-nil, reconciles team_group rows
	// against DesiredExternalGroups inside the same SQL transaction as the
	// team row update.
	ExternalGroupReconciler ExternalGroupReconciler
	DesiredExternalGroups   []string
}

type UpdateTeamResult struct {
	Team team.Team
}

var sqlUpdateTeamTemplate = mustTemplate("update_team.sql")

func newUpdateTeam(sql *legacysql.LegacyDatabaseHelper, cmd *UpdateTeamCommand) updateTeamQuery {
	return updateTeamQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TeamTable:   sql.Table("team"),
		Command:     cmd,
	}
}

type updateTeamQuery struct {
	sqltemplate.SQLTemplate
	TeamTable string
	Command   *UpdateTeamCommand
}

func (r updateTeamQuery) Validate() error {
	return nil
}

// UpdateTeam updates a team and, when the command carries member changes,
// also reconciles those members (deletes, permission updates, additions) in
// the same SQL transaction.
func (s *legacySQLStore) UpdateTeam(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateTeamCommand) (*UpdateTeamResult, error) {
	now := time.Now().UTC()
	cmd.Updated = legacysql.NewDBTime(now)

	sql, err := s.getDB(ctx)
	if err != nil {
		return nil, err
	}

	// Resolve the team's internal ID before opening the write transaction. Doing
	// the read inside WithTransaction would acquire a second DB connection while
	// the tx holds the write lock, which deadlocks on SQLite.
	teamInfo, err := s.GetTeamInternalID(ctx, ns, GetTeamInternalIDQuery{OrgID: ns.OrgID, UID: cmd.UID})
	if err != nil {
		return nil, fmt.Errorf("team not found: %w", err)
	}

	teamReq := newUpdateTeam(sql, &cmd)
	var updatedTeam team.Team

	err = sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		teamQuery, err := sqltemplate.Execute(sqlUpdateTeamTemplate, teamReq)
		if err != nil {
			return fmt.Errorf("failed to execute team update template %q: %w", sqlUpdateTeamTemplate.Name(), err)
		}
		if _, err := st.Exec(ctx, teamQuery, teamReq.GetArgs()...); err != nil {
			return fmt.Errorf("failed to update team: %w", err)
		}

		if len(cmd.MemberDeletes) > 0 {
			uids := make([]string, len(cmd.MemberDeletes))
			for i, d := range cmd.MemberDeletes {
				uids[i] = d.UID
			}
			bulk := DeleteTeamMembersBulkCommand{OrgID: ns.OrgID, UIDs: uids}
			dreq := newDeleteTeamMembersBulk(sql, &bulk)
			dq, err := sqltemplate.Execute(sqlDeleteTeamMembersBulkQuery, dreq)
			if err != nil {
				return fmt.Errorf("failed to execute bulk delete team members template: %w", err)
			}
			if _, err := st.Exec(ctx, dq, dreq.GetArgs()...); err != nil {
				return fmt.Errorf("failed to delete team members: %w", err)
			}
		}

		// Permission updates stay as one statement per row: each row changes to
		// a different target value, so a single bulk UPDATE would need CASE
		// WHEN scaffolding that's not worth the complexity until a profile
		// shows it.
		for i := range cmd.MemberUpdates {
			cmd.MemberUpdates[i].Updated = legacysql.NewDBTime(now)
			ureq := newUpdateTeamMember(sql, &cmd.MemberUpdates[i])
			uq, err := sqltemplate.Execute(sqlUpdateTeamMemberQuery, ureq)
			if err != nil {
				return fmt.Errorf("failed to execute update team member template: %w", err)
			}
			if _, err := st.Exec(ctx, uq, ureq.GetArgs()...); err != nil {
				return fmt.Errorf("failed to update team member: %w", err)
			}
		}

		if len(cmd.MemberCreates) > 0 {
			for i := range cmd.MemberCreates {
				cmd.MemberCreates[i].Created = legacysql.NewDBTime(now)
				cmd.MemberCreates[i].Updated = legacysql.NewDBTime(now)
				cmd.MemberCreates[i].OrgID = ns.OrgID
			}
			bulk := CreateTeamMembersBulkCommand{Members: cmd.MemberCreates}
			creq := newCreateTeamMembersBulk(sql, &bulk)
			cq, err := sqltemplate.Execute(sqlCreateTeamMembersBulkQuery, creq)
			if err != nil {
				return fmt.Errorf("failed to execute bulk create team members template: %w", err)
			}
			if _, err := st.Exec(ctx, cq, creq.GetArgs()...); err != nil {
				if sql.DB.GetDialect().IsUniqueConstraintViolation(err) {
					return team.ErrTeamMemberAlreadyAdded
				}
				return fmt.Errorf("failed to create team members: %w", err)
			}
		}

		if cmd.ExternalGroupReconciler != nil {
			if err := cmd.ExternalGroupReconciler.Reconcile(ctx, st, ns.OrgID, teamInfo.ID, cmd.DesiredExternalGroups); err != nil {
				return fmt.Errorf("failed to reconcile team external groups: %w", err)
			}
		}

		updatedTeam = team.Team{
			UID:           cmd.UID,
			Name:          cmd.Name,
			Email:         cmd.Email,
			ExternalUID:   cmd.ExternalUID,
			IsProvisioned: cmd.IsProvisioned,
			Updated:       cmd.Updated.Time,
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return &UpdateTeamResult{Team: updatedTeam}, nil
}

type DeleteTeamCommand struct {
	UID string
}

var sqlDeleteTeamTemplate = mustTemplate("delete_team.sql")

func newDeleteTeam(sql *legacysql.LegacyDatabaseHelper, cmd *DeleteTeamCommand) deleteTeamQuery {
	return deleteTeamQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TeamTable:   sql.Table("team"),
		Command:     cmd,
	}
}

type deleteTeamQuery struct {
	sqltemplate.SQLTemplate
	TeamTable string
	Command   *DeleteTeamCommand
}

func (r deleteTeamQuery) Validate() error {
	return nil
}

func (s *legacySQLStore) DeleteTeam(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteTeamCommand) error {
	sql, err := s.getDB(ctx)
	if err != nil {
		return err
	}

	req := newDeleteTeam(sql, &cmd)
	if err := req.Validate(); err != nil {
		return err
	}

	return sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		_, err := s.GetTeamInternalID(ctx, ns, GetTeamInternalIDQuery{
			OrgID: ns.OrgID,
			UID:   cmd.UID,
		})
		if err != nil {
			return err
		}

		teamDeleteReq := newDeleteTeam(sql, &cmd)
		if err := teamDeleteReq.Validate(); err != nil {
			return err
		}

		teamDeleteQuery, err := sqltemplate.Execute(sqlDeleteTeamTemplate, teamDeleteReq)
		if err != nil {
			return fmt.Errorf("error executing team delete template: %w", err)
		}

		_, err = st.Exec(ctx, teamDeleteQuery, teamDeleteReq.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to delete team: %w", err)
		}

		return nil
	})
}

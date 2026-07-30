package teamimpl

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamdelete"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util"
)

type store interface {
	Create(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error)
	Update(ctx context.Context, cmd *team.UpdateTeamCommand) error
	Delete(ctx context.Context, cmd *team.DeleteTeamCommand) error
	Search(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error)
	GetByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error)
	GetByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error)
	GetIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, []string, error)
	RemoveUsersMemberships(ctx context.Context, userID int64) error
	IsMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error)
	GetMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*team.TeamMemberDTO, error)
	GetMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error)
	RegisterDelete(renderer teamdelete.Renderer)
}

type xormStore struct {
	sql             legacysql.LegacyDatabaseProvider
	deleteRenderers []teamdelete.Renderer
}

var _ store = (*xormStore)(nil)

// quoteTable resolves a table name and quotes it for use in a raw SQL string.
// Resolved names may be schema-qualified, so they are quoted with db.DB.Quote,
// which quotes each dotted part separately.
//
// Names passed to XORM instead (sess.Table, sess.Join) must be resolved but not
// quoted, because XORM quotes them itself. Call dbHelper.Table directly there.
// Locals holding a quoted name are prefixed with q.
//
// In raw SQL, columns reference tables by their unqualified name (team.x,
// team_member.x) without a self-alias: a qualified reference already exposes
// its unqualified name as the correlation name.
func quoteTable(dbHelper *legacysql.LegacyDatabaseHelper, name string) string {
	return dbHelper.DB.Quote(dbHelper.Table(name))
}

func getFilteredUsers(signedInUser identity.Requester, hiddenUsers map[string]struct{}) []string {
	filteredUsers := make([]string, 0, len(hiddenUsers))
	if signedInUser == nil || signedInUser.IsNil() || signedInUser.GetIsGrafanaAdmin() {
		return filteredUsers
	}

	for u := range hiddenUsers {
		if u == signedInUser.GetLogin() {
			continue
		}
		filteredUsers = append(filteredUsers, u)
	}

	return filteredUsers
}

func (ss *xormStore) Create(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	t := team.Team{
		UID:           util.GenerateShortUID(),
		Name:          cmd.Name,
		Email:         cmd.Email,
		OrgID:         cmd.OrgID,
		ExternalUID:   cmd.ExternalUID,
		IsProvisioned: cmd.IsProvisioned,
		Created:       time.Now(),
		Updated:       time.Now(),
	}

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return t, err
	}

	err = dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isTeamNameTaken(dbHelper, cmd.OrgID, cmd.Name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return team.ErrTeamNameTaken
		}

		_, err := sess.Table(dbHelper.Table("team")).Insert(&t)
		return err
	})
	return t, err
}

func (ss *xormStore) Update(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isTeamNameTaken(dbHelper, cmd.OrgID, cmd.Name, cmd.ID, sess); err != nil {
			return err
		} else if isNameTaken {
			return team.ErrTeamNameTaken
		}

		t := team.Team{
			Name:        cmd.Name,
			Email:       cmd.Email,
			ExternalUID: cmd.ExternalUID,
			Updated:     time.Now(),
		}

		sess.MustCols("email")

		affectedRows, err := sess.Table(dbHelper.Table("team")).ID(cmd.ID).Update(&t)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return team.ErrTeamNotFound
		}

		return nil
	})
}

type deleteTeamMembersQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	OrgID           int64
	TeamID          int64
}

func (q deleteTeamMembersQuery) Validate() error { return nil }

type deleteTeamQuery struct {
	sqltemplate.SQLTemplate
	TeamTable string
	OrgID     int64
	TeamID    int64
}

func (q deleteTeamQuery) Validate() error { return nil }

type deleteDashboardACLQuery struct {
	sqltemplate.SQLTemplate
	DashboardACLTable string
	OrgID             int64
	TeamID            int64
}

func (q deleteDashboardACLQuery) Validate() error { return nil }

// DeleteTeam will delete a team, its members and any permissions connected to the team.
func (ss *xormStore) Delete(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := teamExists(dbHelper, sess, cmd.OrgID, cmd.ID); err != nil {
			return err
		}

		deleteMembers := deleteTeamMembersQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamMemberTable: dbHelper.Table("team_member"),
			OrgID:           cmd.OrgID,
			TeamID:          cmd.ID,
		}
		if err := execTemplate(sess, deleteTeamMembersTemplate, deleteMembers); err != nil {
			return err
		}

		deleteTeam := deleteTeamQuery{
			SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
			TeamTable:   dbHelper.Table("team"),
			OrgID:       cmd.OrgID,
			TeamID:      cmd.ID,
		}
		if err := execTemplate(sess, deleteTeamTemplate, deleteTeam); err != nil {
			return err
		}

		deleteACL := deleteDashboardACLQuery{
			SQLTemplate:       sqltemplate.New(dbHelper.DialectForDriver()),
			DashboardACLTable: dbHelper.Table("dashboard_acl"),
			OrgID:             cmd.OrgID,
			TeamID:            cmd.ID,
		}
		if err := execTemplate(sess, deleteDashboardACLTemplate, deleteACL); err != nil {
			return err
		}

		for _, render := range ss.deleteRenderers {
			query, err := render(dbHelper, cmd.OrgID, cmd.ID)
			if err != nil {
				return err
			}
			if _, err := sess.Exec(append([]any{query.SQL}, query.Args...)...); err != nil {
				return err
			}
		}
		return nil
	})
}

type teamExistsQuery struct {
	sqltemplate.SQLTemplate
	TeamTable string
	OrgID     int64
	TeamID    int64
}

func (q teamExistsQuery) Validate() error { return nil }

func teamExists(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgID int64, teamID int64) (bool, error) {
	query := teamExistsQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		TeamTable:   dbHelper.Table("team"),
		OrgID:       orgID,
		TeamID:      teamID,
	}
	rawSQL, err := sqltemplate.Execute(teamExistsTemplate, query)
	if err != nil {
		return false, err
	}

	if res, err := sess.Query(append([]any{rawSQL}, query.GetArgs()...)...); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, team.ErrTeamNotFound
	}

	return true, nil
}

func isTeamNameTaken(dbHelper *legacysql.LegacyDatabaseHelper, orgId int64, name string, existingId int64, sess *db.Session) (bool, error) {
	var team team.Team
	exists, err := sess.Table(dbHelper.Table("team")).Where("org_id=? and name=?", orgId, name).Get(&team)
	if err != nil {
		return false, nil
	}

	if exists && existingId != team.ID {
		return true, nil
	}

	return false, nil
}

type searchTeamsQuery struct {
	sqltemplate.SQLTemplate
	TeamTable       string
	TeamMemberTable string
	UserTable       string
	FilteredUsers   []string
	OrgID           int64
	NamePattern     string
	Name            string
	TeamIDs         []int64
	UIDs            []string
	AccessAll       bool
	AccessTeamIDs   []any
	Sorts           []string
	Limit           int
	Offset          int
}

func (q searchTeamsQuery) Validate() error { return nil }

func accessControlQueryFields(filter ac.SQLFilter) (bool, []any) {
	return strings.TrimSpace(filter.Where) == "1 = 1", filter.Args
}

func (ss *xormStore) Search(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	queryResult := team.SearchTeamQueryResult{
		Teams: make([]*team.TeamDTO, 0),
	}

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return queryResult, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		acFilter, err := ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
		if err != nil {
			return err
		}
		accessAll, accessTeamIDs := accessControlQueryFields(acFilter)

		sorts := make([]string, 0, len(query.SortOpts))
		for i := range query.SortOpts {
			for j := range query.SortOpts[i].Filter {
				sorts = append(sorts, query.SortOpts[i].Filter[j].OrderBy())
			}
		}

		offset := 0
		if query.Limit != 0 {
			offset = query.Limit * (query.Page - 1)
		}
		namePattern := ""
		if query.Query != "" {
			namePattern = "%" + query.Query + "%"
		}

		sqlQuery := searchTeamsQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserTable:       dbHelper.Table("user"),
			FilteredUsers:   filteredUsers,
			OrgID:           query.OrgID,
			NamePattern:     namePattern,
			Name:            query.Name,
			TeamIDs:         query.TeamIds,
			UIDs:            query.UIDs,
			AccessAll:       accessAll,
			AccessTeamIDs:   accessTeamIDs,
			Sorts:           sorts,
			Limit:           query.Limit,
			Offset:          offset,
		}
		rawSQL, err := sqltemplate.Execute(searchTeamsTemplate, sqlQuery)
		if err != nil {
			return err
		}

		if err := sess.SQL(rawSQL, sqlQuery.GetArgs()...).Find(&queryResult.Teams); err != nil {
			return err
		}

		t := team.Team{}
		countSess := sess.Table(dbHelper.Table("team"))
		countSess.Where("team.org_id=?", query.OrgID)

		if query.Query != "" {
			like, param := dbHelper.DB.GetDialect().LikeOperator("name", true, query.Query, true)
			countSess.Where(like, param)
		}

		if query.Name != "" {
			countSess.Where("LOWER(name) = LOWER(?)", query.Name)
		}

		if len(query.TeamIds) > 0 {
			countSess.In("team.id", query.TeamIds)
		}

		if len(query.UIDs) > 0 {
			countSess.In("team.uid", query.UIDs)
		}

		// Only count teams user can see
		countSess.Where(acFilter.Where, acFilter.Args...)

		count, err := countSess.Count(&t)
		queryResult.TotalCount = count

		return err
	})
	if err != nil {
		return team.SearchTeamQueryResult{}, err
	}
	return queryResult, nil
}

type getTeamByIDQuery struct {
	sqltemplate.SQLTemplate
	TeamTable       string
	TeamMemberTable string
	UserTable       string
	FilteredUsers   []string
	OrgID           int64
	ID              int64
	UID             string
}

func (q getTeamByIDQuery) Validate() error { return nil }

func (ss *xormStore) GetByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	var queryResult *team.TeamDTO

	// Check if both ID and UID are unset
	if query.ID == 0 && query.UID == "" {
		return nil, errors.New("either ID or UID must be set")
	}

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		sqlQuery := getTeamByIDQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserTable:       dbHelper.Table("user"),
			FilteredUsers:   filteredUsers,
			OrgID:           query.OrgID,
			ID:              query.ID,
			UID:             query.UID,
		}
		rawSQL, err := sqltemplate.Execute(getTeamByIDTemplate, sqlQuery)
		if err != nil {
			return err
		}

		var t team.TeamDTO
		exists, err := sess.SQL(rawSQL, sqlQuery.GetArgs()...).Get(&t)

		if err != nil {
			return err
		}

		if !exists {
			return team.ErrTeamNotFound
		}

		queryResult = &t
		return nil
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

type getTeamsByUserQuery struct {
	sqltemplate.SQLTemplate
	TeamTable       string
	TeamMemberTable string
	OrgID           int64
	UserID          int64
	AccessAll       bool
	AccessTeamIDs   []any
}

func (q getTeamsByUserQuery) Validate() error { return nil }

// GetTeamsByUser is used by the Guardian when checking a users' permissions
func (ss *xormStore) GetByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	queryResult := make([]*team.TeamDTO, 0)
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		acFilter, err := ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
		if err != nil {
			return err
		}
		accessAll, accessTeamIDs := accessControlQueryFields(acFilter)

		sqlQuery := getTeamsByUserQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			OrgID:           query.OrgID,
			UserID:          query.UserID,
			AccessAll:       accessAll,
			AccessTeamIDs:   accessTeamIDs,
		}
		rawSQL, err := sqltemplate.Execute(getTeamsByUserTemplate, sqlQuery)
		if err != nil {
			return err
		}

		return sess.SQL(rawSQL, sqlQuery.GetArgs()...).Find(&queryResult)
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

type getTeamIDsByUserQuery struct {
	sqltemplate.SQLTemplate
	TeamTable       string
	TeamMemberTable string
	UserID          int64
	OrgID           int64
}

func (q getTeamIDsByUserQuery) Validate() error { return nil }

// GetIDsByUser returns a list of team IDs for the given user
func (ss *xormStore) GetIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, []string, error) {
	ids := make([]int64, 0)
	uids := make([]string, 0)

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, nil, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		sqlQuery := getTeamIDsByUserQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserID:          query.UserID,
			OrgID:           query.OrgID,
		}
		rawSQL, err := sqltemplate.Execute(getTeamIDsByUserTemplate, sqlQuery)
		if err != nil {
			return err
		}

		rows, err := sess.QueryRows(rawSQL, sqlQuery.GetArgs()...)
		if err != nil {
			return err
		}
		defer func() {
			_ = rows.Close()
		}()
		var id int64
		var uid string
		for rows.Next() {
			err = rows.Scan(&id, &uid)
			if err != nil {
				return err
			}
			ids = append(ids, id)
			uids = append(uids, uid)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get team IDs by user: %w", err)
	}
	return ids, uids, nil
}

type isTeamMemberQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	OrgID           int64
	TeamID          int64
	UserID          int64
}

func (q isTeamMemberQuery) Validate() error { return nil }

type getTeamMemberQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	OrgID           int64
	TeamID          int64
	UserID          int64
}

func (q getTeamMemberQuery) Validate() error { return nil }

func getTeamMember(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgId int64, teamId int64, userId int64) (team.TeamMember, error) {
	query := getTeamMemberQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		TeamMemberTable: dbHelper.Table("team_member"),
		OrgID:           orgId,
		TeamID:          teamId,
		UserID:          userId,
	}
	rawSQL, err := sqltemplate.Execute(getTeamMemberTemplate, query)
	if err != nil {
		return team.TeamMember{}, err
	}

	var member team.TeamMember
	exists, err := sess.SQL(rawSQL, query.GetArgs()...).Get(&member)

	if err != nil {
		return member, err
	}
	if !exists {
		return member, team.ErrTeamMemberNotFound
	}

	return member, nil
}

func (ss *xormStore) IsMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	var isMember bool

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return false, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		isMember, err = isTeamMember(dbHelper, sess, orgId, teamId, userId)
		return err
	})

	return isMember, err
}

func isTeamMember(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgId int64, teamId int64, userId int64) (bool, error) {
	query := isTeamMemberQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		TeamMemberTable: dbHelper.Table("team_member"),
		OrgID:           orgId,
		TeamID:          teamId,
		UserID:          userId,
	}
	rawSQL, err := sqltemplate.Execute(isTeamMemberTemplate, query)
	if err != nil {
		return false, err
	}

	if res, err := sess.Query(append([]any{rawSQL}, query.GetArgs()...)...); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, nil
	}

	return true, nil
}

// AddOrUpdateTeamMemberHook is called from team resource permission service
// it adds user to a team or updates user permissions in a team within the given transaction session
func AddOrUpdateTeamMemberHook(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, userID, orgID, teamID int64, isExternal bool, permission team.PermissionType) error {
	isMember, err := isTeamMember(dbHelper, sess, orgID, teamID, userID)
	if err != nil {
		return err
	}

	if isMember {
		err = updateTeamMember(dbHelper, sess, orgID, teamID, userID, permission)
	} else {
		err = addTeamMember(dbHelper, sess, orgID, teamID, userID, isExternal, permission)
	}

	return err
}

func addTeamMember(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgID, teamID, userID int64, isExternal bool, permission team.PermissionType) error {
	if _, err := teamExists(dbHelper, sess, orgID, teamID); err != nil {
		return err
	}

	entity := team.TeamMember{
		UID:        util.GenerateShortUID(),
		OrgID:      orgID,
		TeamID:     teamID,
		UserID:     userID,
		External:   isExternal,
		Created:    time.Now(),
		Updated:    time.Now(),
		Permission: permission,
	}

	_, err := sess.Table(dbHelper.Table("team_member")).Insert(&entity)
	return err
}

func updateTeamMember(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgID, teamID, userID int64, permission team.PermissionType) error {
	member, err := getTeamMember(dbHelper, sess, orgID, teamID, userID)
	if err != nil {
		return err
	}

	if permission != team.PermissionTypeAdmin {
		permission = team.PermissionTypeMember // make sure we don't get invalid permission levels in store
	}

	member.Permission = permission
	_, err = sess.Table(dbHelper.Table("team_member")).Cols("permission").Where("org_id=? and team_id=? and user_id=?", orgID, teamID, userID).Update(member)
	return err
}

// RemoveTeamMemberHook is called from team resource permission service
// it removes a member from a team within the given transaction session
func RemoveTeamMemberHook(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, cmd *team.RemoveTeamMemberCommand) error {
	return removeTeamMember(dbHelper, sess, cmd)
}

type removeTeamMemberQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	OrgID           int64
	TeamID          int64
	UserID          int64
}

func (q removeTeamMemberQuery) Validate() error { return nil }

func removeTeamMember(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, cmd *team.RemoveTeamMemberCommand) error {
	if _, err := teamExists(dbHelper, sess, cmd.OrgID, cmd.TeamID); err != nil {
		return err
	}

	query := removeTeamMemberQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		TeamMemberTable: dbHelper.Table("team_member"),
		OrgID:           cmd.OrgID,
		TeamID:          cmd.TeamID,
		UserID:          cmd.UserID,
	}
	rawSQL, err := sqltemplate.Execute(removeTeamMemberTemplate, query)
	if err != nil {
		return err
	}
	res, err := sess.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if rows == 0 {
		return team.ErrTeamMemberNotFound
	}

	return err
}

type removeUserMembershipsQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	UserID          int64
}

func (q removeUserMembershipsQuery) Validate() error { return nil }

// RemoveUsersMemberships removes all the team membership entries for the given user.
// Only used when removing a user from a Grafana instance.
func (ss *xormStore) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		query := removeUserMembershipsQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserID:          userID,
		}
		rawSQL, err := sqltemplate.Execute(removeUserMembershipsTemplate, query)
		if err != nil {
			return err
		}
		_, err = sess.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
		return err
	})
}

// GetUserTeamMemberships return a list of memberships to teams granted to a user
// If external is specified, only memberships provided by an external auth provider will be listed
// This function doesn't perform any accesscontrol filtering.
func (ss *xormStore) GetMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*team.TeamMemberDTO, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, err
	}

	query := &team.GetTeamMembersQuery{
		OrgID:    orgID,
		UserID:   userID,
		External: external,
	}
	return ss.getTeamMembers(ctx, dbHelper, query, nil)
}

// GetTeamMembers return a list of members for the specified team filtered based on the user's permissions
func (ss *xormStore) GetMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	acFilter := &ac.SQLFilter{}
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, err
	}

	// With accesscontrol we filter out users based on the SignedInUser's permissions
	// Note we assume that checking SignedInUser is allowed to see team members for this team has already been performed
	// If the signed in user is not set no member will be returned
	sqlID := fmt.Sprintf("%s.%s", dbHelper.DB.GetDialect().Quote("user"), dbHelper.DB.GetDialect().Quote("id"))
	*acFilter, err = ac.Filter(query.SignedInUser, sqlID, "users:id:", ac.ActionOrgUsersRead)
	if err != nil {
		return nil, err
	}

	return ss.getTeamMembers(ctx, dbHelper, query, acFilter)
}

// getTeamMembers return a list of members for the specified team
func (ss *xormStore) getTeamMembers(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, query *team.GetTeamMembersQuery, acUserFilter *ac.SQLFilter) ([]*team.TeamMemberDTO, error) {
	queryResult := make([]*team.TeamMemberDTO, 0)

	err := dbHelper.DB.WithDbSession(ctx, func(dbSess *db.Session) error {
		// Resolved but unquoted: these are handed to XORM, which quotes them itself.
		// The correlated subquery below builds raw SQL and so uses quoteTable.
		teamMemberTable := dbHelper.Table("team_member")
		userTable := dbHelper.Table("user")
		teamTable := dbHelper.Table("team")
		userAuthTable := dbHelper.Table("user_auth")
		userRef := dbHelper.DB.GetDialect().Quote("user")
		sess := dbSess.Table(teamMemberTable)
		sess.Join("INNER", []string{userTable, "user"},
			fmt.Sprintf("team_member.user_id=%s.%s", userRef, dbHelper.DB.GetDialect().Quote("id")),
		)
		sess.Join("INNER", []string{teamTable, "team"}, "team.id=team_member.team_id")

		// explicitly check for serviceaccounts
		sess.Where(fmt.Sprintf("%s.is_service_account=?", userRef), dbHelper.DB.GetDialect().BooleanValue(false))

		if acUserFilter != nil {
			sess.Where(acUserFilter.Where, acUserFilter.Args...)
		}

		// Join with only most recent auth module
		authJoinCondition := `user_auth.id=(
			SELECT id
			FROM ` + quoteTable(dbHelper, "user_auth") + ` AS user_auth
			WHERE user_auth.user_id = team_member.user_id
			ORDER BY user_auth.created DESC ` +
			dbHelper.DB.GetDialect().Limit(1) + ")"
		sess.Join("LEFT", []string{userAuthTable, "user_auth"}, authJoinCondition)

		if query.OrgID != 0 {
			sess.Where("team_member.org_id=?", query.OrgID)
		}
		if query.TeamID != 0 {
			sess.Where("team_member.team_id=?", query.TeamID)
		}
		if query.TeamUID != "" {
			sess.Where("team.uid=?", query.TeamUID)
		}
		if query.UserID != 0 {
			sess.Where("team_member.user_id=?", query.UserID)
		}
		if query.External {
			sess.Where("team_member.external=?", dbHelper.DB.GetDialect().BooleanValue(true))
		}
		sess.Select(fmt.Sprintf(`team_member.org_id,
			team_member.team_id,
			team_member.user_id,
			team_member.uid,
			%[1]s.email,
			%[1]s.name,
			%[1]s.login,
			%[1]s.uid as user_uid,
			team_member.external,
			team_member.permission,
			user_auth.auth_module,
			team.uid as team_uid`, userRef))
		sess.Asc("user.login", "user.email")

		err := sess.Find(&queryResult)
		return err
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

// RegisterDelete registers a query to run when a team is deleted.
func (ss *xormStore) RegisterDelete(renderer teamdelete.Renderer) {
	ss.deleteRenderers = append(ss.deleteRenderers, renderer)
}

func execTemplate(sess *db.Session, tmpl *template.Template, query sqltemplate.SQLTemplate) error {
	rawSQL, err := sqltemplate.Execute(tmpl, query)
	if err != nil {
		return err
	}
	_, err = sess.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
	return err
}

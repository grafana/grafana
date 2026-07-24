package teamimpl

import (
	"context"
	"errors"
	"fmt"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
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
	IsMember(orgId int64, teamId int64, userId int64) (bool, error)
	GetMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*team.TeamMemberDTO, error)
	GetMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error)
	RegisterDelete(query string)
}

// xormStore resolves qualified table names from the provider at operation time.
type xormStore struct {
	sql     legacysql.LegacyDatabaseProvider
	cfg     *setting.Cfg
	deletes []string
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

type searchTeamsQuery struct {
	sqltemplate.SQLTemplate
	TeamTable       string
	TeamMemberTable string
	UserTable       string

	FilteredUsers []string
	LikeWhere     string
	HasNameFilter bool
	TeamIDs       []int64
	UIDs          []string
	ACFilterWhere string
	OrderBy       string
	LimitClause   string
}

func (q searchTeamsQuery) Validate() error { return nil }

func (ss *xormStore) Create(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return team.Team{}, err
	}

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
	err = dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isTeamNameTaken(dbHelper, sess, cmd.OrgID, cmd.Name, 0); err != nil {
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
		if isNameTaken, err := isTeamNameTaken(dbHelper, sess, cmd.OrgID, cmd.Name, cmd.ID); err != nil {
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

		affectedRows, err := sess.Table(dbHelper.Table("team")).MustCols("email").ID(cmd.ID).Update(&t)
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

// Delete will delete a team, its members and any permissions connected to the team
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

		// Registered deletes are provided by other packages as raw SQL and are
		// executed with the org and team IDs.
		for _, sql := range ss.deletes {
			if _, err := sess.Exec(sql, cmd.OrgID, cmd.ID); err != nil {
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
	sqlStr, err := sqltemplate.Execute(teamExistsTemplate, query)
	if err != nil {
		return false, err
	}
	if res, err := sess.Query(append([]any{sqlStr}, query.GetArgs()...)...); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, team.ErrTeamNotFound
	}

	return true, nil
}

func isTeamNameTaken(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgId int64, name string, existingId int64) (bool, error) {
	var t team.Team
	exists, err := sess.Table(dbHelper.Table("team")).Where("org_id=? and name=?", orgId, name).Get(&t)
	if err != nil {
		return false, nil
	}

	if exists && existingId != t.ID {
		return true, nil
	}

	return false, nil
}

func (ss *xormStore) Search(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return team.SearchTeamQueryResult{}, err
	}

	queryResult := team.SearchTeamQueryResult{
		Teams: make([]*team.TeamDTO, 0),
	}
	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)

		acFilter, err := ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
		if err != nil {
			return err
		}

		req := searchTeamsQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserTable:       dbHelper.Table("user"),
			FilteredUsers:   filteredUsers,
			TeamIDs:         query.TeamIds,
			UIDs:            query.UIDs,
			HasNameFilter:   query.Name != "",
			ACFilterWhere:   acFilter.Where,
		}

		// params must be appended in the same order the placeholders are
		// rendered in the template.
		params := make([]any, 0)
		for _, user := range filteredUsers {
			params = append(params, user)
		}
		params = append(params, query.OrgID)

		if query.Query != "" {
			like, param := dbHelper.DB.GetDialect().LikeOperator("team.name", true, query.Query, true)
			req.LikeWhere = like
			params = append(params, param)
		}

		if query.Name != "" {
			params = append(params, query.Name)
		}

		for _, id := range query.TeamIds {
			params = append(params, id)
		}

		for _, uid := range query.UIDs {
			params = append(params, uid)
		}

		params = append(params, acFilter.Args...)

		if len(query.SortOpts) > 0 {
			orderBy := ` order by `
			for i := range query.SortOpts {
				for j := range query.SortOpts[i].Filter {
					orderBy += query.SortOpts[i].Filter[j].OrderBy() + ","
				}
			}
			req.OrderBy = orderBy[:len(orderBy)-1]
		} else {
			req.OrderBy = ` order by team.name asc`
		}

		if query.Limit != 0 {
			offset := query.Limit * (query.Page - 1)
			req.LimitClause = dbHelper.DB.GetDialect().LimitOffset(int64(query.Limit), int64(offset))
		}

		sqlStr, err := sqltemplate.Execute(searchTeamsTemplate, req)
		if err != nil {
			return err
		}

		if err := sess.SQL(sqlStr, params...).Find(&queryResult.Teams); err != nil {
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

	FilteredUsers []string
	ByUID         bool
}

func (q getTeamByIDQuery) Validate() error { return nil }

func (ss *xormStore) GetByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	// Check if both ID and UID are unset
	if query.ID == 0 && query.UID == "" {
		return nil, errors.New("either ID or UID must be set")
	}

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, err
	}

	var queryResult *team.TeamDTO
	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)

		req := getTeamByIDQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			UserTable:       dbHelper.Table("user"),
			FilteredUsers:   filteredUsers,
			// Prioritize ID over UID
			ByUID: query.ID == 0,
		}

		params := make([]any, 0)
		for _, user := range filteredUsers {
			params = append(params, user)
		}
		params = append(params, query.OrgID)
		if req.ByUID {
			params = append(params, query.UID)
		} else {
			params = append(params, query.ID)
		}

		sqlStr, err := sqltemplate.Execute(getTeamByIDTemplate, req)
		if err != nil {
			return err
		}

		var t team.TeamDTO
		exists, err := sess.SQL(sqlStr, params...).Get(&t)
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

	ACFilterWhere string
}

func (q getTeamsByUserQuery) Validate() error { return nil }

// GetByUser is used by the Guardian when checking a users' permissions
func (ss *xormStore) GetByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, err
	}

	queryResult := make([]*team.TeamDTO, 0)
	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		acFilter, err := ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
		if err != nil {
			return err
		}

		req := getTeamsByUserQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			TeamTable:       dbHelper.Table("team"),
			TeamMemberTable: dbHelper.Table("team_member"),
			ACFilterWhere:   acFilter.Where,
		}

		params := make([]any, 0, 2+len(acFilter.Args))
		params = append(params, query.OrgID, query.UserID)
		params = append(params, acFilter.Args...)

		sqlStr, err := sqltemplate.Execute(getTeamsByUserTemplate, req)
		if err != nil {
			return err
		}

		return sess.SQL(sqlStr, params...).Find(&queryResult)
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

type teamIDsByUserQuery struct {
	sqltemplate.SQLTemplate
	TeamTable       string
	TeamMemberTable string
	UserID          int64
	OrgID           int64
}

func (q teamIDsByUserQuery) Validate() error { return nil }

// GetIDsByUser returns a list of team IDs for the given user
func (ss *xormStore) GetIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, []string, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, nil, err
	}

	ids := make([]int64, 0)
	uids := make([]string, 0)

	req := teamIDsByUserQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		TeamTable:       dbHelper.Table("team"),
		TeamMemberTable: dbHelper.Table("team_member"),
		UserID:          query.UserID,
		OrgID:           query.OrgID,
	}
	sqlStr, err := sqltemplate.Execute(getTeamIDsByUserTemplate, req)
	if err != nil {
		return nil, nil, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.QueryRows(sqlStr, req.GetArgs()...)
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
	sqlStr, err := sqltemplate.Execute(getTeamMemberTemplate, query)
	if err != nil {
		return team.TeamMember{}, err
	}

	var member team.TeamMember
	exists, err := sess.SQL(sqlStr, query.GetArgs()...).Get(&member)
	if err != nil {
		return member, err
	}
	if !exists {
		return member, team.ErrTeamMemberNotFound
	}

	return member, nil
}

func (ss *xormStore) IsMember(orgId int64, teamId int64, userId int64) (bool, error) {
	dbHelper, err := ss.sql(context.Background())
	if err != nil {
		return false, err
	}

	var isMember bool
	err = dbHelper.DB.WithDbSession(context.Background(), func(sess *db.Session) error {
		var err error
		isMember, err = isTeamMember(dbHelper, sess, orgId, teamId, userId)
		return err
	})

	return isMember, err
}

type isTeamMemberQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	OrgID           int64
	TeamID          int64
	UserID          int64
}

func (q isTeamMemberQuery) Validate() error { return nil }

func isTeamMember(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgId int64, teamId int64, userId int64) (bool, error) {
	query := isTeamMemberQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		TeamMemberTable: dbHelper.Table("team_member"),
		OrgID:           orgId,
		TeamID:          teamId,
		UserID:          userId,
	}
	sqlStr, err := sqltemplate.Execute(isTeamMemberTemplate, query)
	if err != nil {
		return false, err
	}
	if res, err := sess.Query(append([]any{sqlStr}, query.GetArgs()...)...); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, nil
	}

	return true, nil
}

// AddOrUpdateTeamMemberHook is called from team resource permission service
// it adds user to a team or updates user permissions in a team within the given transaction session.
// dbHelper resolves qualified table names.
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

type removeTeamMemberQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
	OrgID           int64
	TeamID          int64
	UserID          int64
}

func (q removeTeamMemberQuery) Validate() error { return nil }

// RemoveTeamMemberHook is called from team resource permission service
// it removes a member from a team within the given transaction session.
// dbHelper resolves qualified table names.
func RemoveTeamMemberHook(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, cmd *team.RemoveTeamMemberCommand) error {
	return removeTeamMember(dbHelper, sess, cmd)
}

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
	sqlStr, err := sqltemplate.Execute(removeTeamMemberTemplate, query)
	if err != nil {
		return err
	}
	res, err := sess.Exec(append([]any{sqlStr}, query.GetArgs()...)...)
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

	query := removeUserMembershipsQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		TeamMemberTable: dbHelper.Table("team_member"),
		UserID:          userID,
	}
	sqlStr, err := sqltemplate.Execute(removeUserMembershipTemplate, query)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec(append([]any{sqlStr}, query.GetArgs()...)...)
		return err
	})
}

// GetMemberships return a list of memberships to teams granted to a user
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
	queryResult, err := ss.getTeamMembers(ctx, dbHelper, query, nil)
	return queryResult, err
}

// GetMembers return a list of members for the specified team filtered based on the user's permissions
func (ss *xormStore) GetMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, err
	}

	acFilter := &ac.SQLFilter{}

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
		dialect := dbHelper.DB.GetDialect()
		sess := dbSess.Table(dbHelper.Table("team_member"))
		sess.Join("INNER", dbHelper.Table("user"),
			fmt.Sprintf("team_member.user_id=%s.%s", dialect.Quote("user"), dialect.Quote("id")),
		)
		sess.Join("INNER", dbHelper.Table("team"), "team.id=team_member.team_id")

		// explicitly check for serviceaccounts
		sess.Where(fmt.Sprintf("%s.is_service_account=?", dialect.Quote("user")), dialect.BooleanValue(false))

		if acUserFilter != nil {
			sess.Where(acUserFilter.Where, acUserFilter.Args...)
		}

		// Join with only most recent auth module
		authJoinCondition := `user_auth.id=(
			SELECT id
			FROM ` + dbHelper.Table("user_auth") + `
			WHERE user_auth.user_id = team_member.user_id
			ORDER BY user_auth.created DESC ` +
			dialect.Limit(1) + ")"
		sess.Join("LEFT", dbHelper.Table("user_auth"), authJoinCondition)

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
			sess.Where("team_member.external=?", dialect.BooleanValue(true))
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
			team.uid as team_uid`, dialect.Quote("user")))
		sess.Asc("user.login", "user.email")

		err := sess.Find(&queryResult)
		return err
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

// RegisterDelete registers a delete query to be executed when the transaction is committed
func (ss *xormStore) RegisterDelete(query string) {
	ss.deletes = append(ss.deletes, query)
}

type teamMemberUIDMigrationQuery struct {
	sqltemplate.SQLTemplate
	TeamMemberTable string
}

func (q teamMemberUIDMigrationQuery) Validate() error { return nil }

// teamMemberUidMigration ensures that all team members have a valid uid.
// To protect against upgrade / downgrade we need to run this for a couple of releases.
// FIXME: Remove this migration around Q2 2026
func (ss *xormStore) teamMemberUidMigration() error {
	ctx := context.Background()
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return err
	}

	query := teamMemberUIDMigrationQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		TeamMemberTable: dbHelper.Table("team_member"),
	}
	sqlStr, err := sqltemplate.Execute(teamMemberUIDMigrationTmpl, query)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec(append([]any{sqlStr}, query.GetArgs()...)...)
		return err
	})
}

// execTemplate renders and executes a statement inside the provided session.
func execTemplate(sess *db.Session, tmpl *template.Template, data sqltemplate.SQLTemplate) error {
	sqlStr, err := sqltemplate.Execute(tmpl, data)
	if err != nil {
		return err
	}
	_, err = sess.Exec(append([]any{sqlStr}, data.GetArgs()...)...)
	return err
}

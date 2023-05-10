package teamimpl

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type store interface {
	Create(name, email string, orgID int64) (team.Team, error)
	Update(ctx context.Context, cmd *team.UpdateTeamCommand) error
	Delete(ctx context.Context, cmd *team.DeleteTeamCommand) error
	Search(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error)
	GetByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error)
	GetByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error)
	AddMember(userID, orgID, teamID int64, isExternal bool, permission dashboards.PermissionType) error
	UpdateMember(ctx context.Context, cmd *team.UpdateTeamMemberCommand) error
	IsMember(orgId int64, teamId int64, userId int64) (bool, error)
	RemoveMember(ctx context.Context, cmd *team.RemoveTeamMemberCommand) error
	GetMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*team.TeamMemberDTO, error)
	GetMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error)
	IsAdmin(ctx context.Context, query *team.IsAdminOfTeamsQuery) (bool, error)
}

type xormStore struct {
	db  db.DB
	cfg *setting.Cfg
}

func getFilteredUsers(signedInUser *user.SignedInUser, hiddenUsers map[string]struct{}) []string {
	filteredUsers := make([]string, 0, len(hiddenUsers))
	if signedInUser == nil || signedInUser.IsGrafanaAdmin {
		return filteredUsers
	}

	for u := range hiddenUsers {
		if u == signedInUser.Login {
			continue
		}
		filteredUsers = append(filteredUsers, u)
	}

	return filteredUsers
}

func getTeamMemberCount(db db.DB, filteredUsers []string) string {
	if len(filteredUsers) > 0 {
		return `(SELECT COUNT(*) FROM team_member
			INNER JOIN ` + db.GetDialect().Quote("user") + ` ON team_member.user_id = ` + db.GetDialect().Quote("user") + `.id
			WHERE team_member.team_id = team.id AND ` + db.GetDialect().Quote("user") + `.login NOT IN (?` +
			strings.Repeat(",?", len(filteredUsers)-1) + ")" +
			`) AS member_count `
	}

	return "(SELECT COUNT(*) FROM team_member WHERE team_member.team_id = team.id) AS member_count "
}

func getTeamSelectSQLBase(db db.DB, filteredUsers []string) string {
	return `SELECT
		team.id as id,
		team.uid,
		team.org_id,
		team.name as name,
		team.email as email, ` +
		getTeamMemberCount(db, filteredUsers) +
		` FROM team as team `
}

func getTeamSelectWithPermissionsSQLBase(db db.DB, filteredUsers []string) string {
	return `SELECT
		team.id AS id,
		team.uid,
		team.org_id,
		team.name AS name,
		team.email AS email,
		team_member.permission, ` +
		getTeamMemberCount(db, filteredUsers) +
		` FROM team AS team
		INNER JOIN team_member ON team.id = team_member.team_id AND team_member.user_id = ? `
}

func (ss *xormStore) Create(name, email string, orgID int64) (team.Team, error) {
	t := team.Team{
		UID:     util.GenerateShortUID(),
		Name:    name,
		Email:   email,
		OrgID:   orgID,
		Created: time.Now(),
		Updated: time.Now(),
	}
	err := ss.db.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
		if isNameTaken, err := isTeamNameTaken(orgID, name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return team.ErrTeamNameTaken
		}

		_, err := sess.Insert(&t)
		return err
	})
	return t, err
}

func (ss *xormStore) Update(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isTeamNameTaken(cmd.OrgID, cmd.Name, cmd.ID, sess); err != nil {
			return err
		} else if isNameTaken {
			return team.ErrTeamNameTaken
		}

		t := team.Team{
			Name:    cmd.Name,
			Email:   cmd.Email,
			Updated: time.Now(),
		}

		sess.MustCols("email")

		affectedRows, err := sess.ID(cmd.ID).Update(&t)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return team.ErrTeamNotFound
		}

		return nil
	})
}

// DeleteTeam will delete a team, its member and any permissions connected to the team
func (ss *xormStore) Delete(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := teamExists(cmd.OrgID, cmd.ID, sess); err != nil {
			return err
		}

		deletes := []string{
			"DELETE FROM team_member WHERE org_id=? and team_id = ?",
			"DELETE FROM team WHERE org_id=? and id = ?",
			"DELETE FROM dashboard_acl WHERE org_id=? and team_id = ?",
			"DELETE FROM team_role WHERE org_id=? and team_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.OrgID, cmd.ID)
			if err != nil {
				return err
			}
		}

		_, err := sess.Exec("DELETE FROM permission WHERE scope=?", ac.Scope("teams", "id", fmt.Sprint(cmd.ID)))

		return err
	})
}

func teamExists(orgID int64, teamID int64, sess *db.Session) (bool, error) {
	if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", orgID, teamID); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, team.ErrTeamNotFound
	}

	return true, nil
}

func isTeamNameTaken(orgId int64, name string, existingId int64, sess *db.Session) (bool, error) {
	var team team.Team
	exists, err := sess.Where("org_id=? and name=?", orgId, name).Get(&team)
	if err != nil {
		return false, nil
	}

	if exists && existingId != team.ID {
		return true, nil
	}

	return false, nil
}

func (ss *xormStore) Search(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	queryResult := team.SearchTeamQueryResult{
		Teams: make([]*team.TeamDTO, 0),
	}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		queryWithWildcards := "%" + query.Query + "%"

		var sql bytes.Buffer
		params := make([]interface{}, 0)

		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		for _, user := range filteredUsers {
			params = append(params, user)
		}

		if query.UserIDFilter == team.FilterIgnoreUser {
			sql.WriteString(getTeamSelectSQLBase(ss.db, filteredUsers))
		} else {
			sql.WriteString(getTeamSelectWithPermissionsSQLBase(ss.db, filteredUsers))
			params = append(params, query.UserIDFilter)
		}

		sql.WriteString(` WHERE team.org_id = ?`)
		params = append(params, query.OrgID)

		if query.Query != "" {
			sql.WriteString(` and team.name ` + ss.db.GetDialect().LikeStr() + ` ?`)
			params = append(params, queryWithWildcards)
		}

		if query.Name != "" {
			sql.WriteString(` and team.name = ?`)
			params = append(params, query.Name)
		}

		var (
			acFilter ac.SQLFilter
			err      error
		)
		if !ac.IsDisabled(ss.cfg) {
			acFilter, err = ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
			if err != nil {
				return err
			}
			sql.WriteString(` and` + acFilter.Where)
			params = append(params, acFilter.Args...)
		}

		sql.WriteString(` order by team.name asc`)

		if query.Limit != 0 {
			offset := query.Limit * (query.Page - 1)
			sql.WriteString(ss.db.GetDialect().LimitOffset(int64(query.Limit), int64(offset)))
		}

		if err := sess.SQL(sql.String(), params...).Find(&queryResult.Teams); err != nil {
			return err
		}

		t := team.Team{}
		countSess := sess.Table("team")
		countSess.Where("team.org_id=?", query.OrgID)

		if query.Query != "" {
			countSess.Where(`name `+ss.db.GetDialect().LikeStr()+` ?`, queryWithWildcards)
		}

		if query.Name != "" {
			countSess.Where("name=?", query.Name)
		}

		// If we're not retrieving all results, then only search for teams that this user has access to
		if query.UserIDFilter != team.FilterIgnoreUser {
			countSess.
				Where(`
			team.id IN (
				SELECT
				team_id
				FROM team_member
				WHERE team_member.user_id = ?
			)`, query.UserIDFilter)
		}

		// Only count teams user can see
		if !ac.IsDisabled(ss.cfg) {
			countSess.Where(acFilter.Where, acFilter.Args...)
		}

		count, err := countSess.Count(&t)
		queryResult.TotalCount = count

		return err
	})
	if err != nil {
		return team.SearchTeamQueryResult{}, err
	}
	return queryResult, nil
}

func (ss *xormStore) GetByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	var queryResult *team.TeamDTO
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var sql bytes.Buffer
		params := make([]interface{}, 0)

		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		sql.WriteString(getTeamSelectSQLBase(ss.db, filteredUsers))
		for _, user := range filteredUsers {
			params = append(params, user)
		}

		if query.UserIdFilter != team.FilterIgnoreUser {
			sql.WriteString(` INNER JOIN team_member ON team.id = team_member.team_id AND team_member.user_id = ?`)
			params = append(params, query.UserIdFilter)
		}

		sql.WriteString(` WHERE team.org_id = ? and team.id = ?`)
		params = append(params, query.OrgID, query.ID)

		var t team.TeamDTO
		exists, err := sess.SQL(sql.String(), params...).Get(&t)

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

// GetTeamsByUser is used by the Guardian when checking a users' permissions
func (ss *xormStore) GetByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	queryResult := make([]*team.TeamDTO, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var sql bytes.Buffer
		var params []interface{}
		params = append(params, query.OrgID, query.UserID)

		sql.WriteString(getTeamSelectSQLBase(ss.db, []string{}))
		sql.WriteString(` INNER JOIN team_member on team.id = team_member.team_id`)
		sql.WriteString(` WHERE team.org_id = ? and team_member.user_id = ?`)

		if !ac.IsDisabled(ss.cfg) {
			acFilter, err := ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
			if err != nil {
				return err
			}
			sql.WriteString(` and` + acFilter.Where)
			params = append(params, acFilter.Args...)
		}

		err := sess.SQL(sql.String(), params...).Find(&queryResult)
		return err
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

// AddTeamMember adds a user to a team
func (ss *xormStore) AddMember(userID, orgID, teamID int64, isExternal bool, permission dashboards.PermissionType) error {
	return ss.db.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
		if isMember, err := isTeamMember(sess, orgID, teamID, userID); err != nil {
			return err
		} else if isMember {
			return team.ErrTeamMemberAlreadyAdded
		}

		return addTeamMember(sess, orgID, teamID, userID, isExternal, permission)
	})
}

func getTeamMember(sess *db.Session, orgId int64, teamId int64, userId int64) (team.TeamMember, error) {
	rawSQL := `SELECT * FROM team_member WHERE org_id=? and team_id=? and user_id=?`
	var member team.TeamMember
	exists, err := sess.SQL(rawSQL, orgId, teamId, userId).Get(&member)

	if err != nil {
		return member, err
	}
	if !exists {
		return member, team.ErrTeamMemberNotFound
	}

	return member, nil
}

// UpdateTeamMember updates a team member
func (ss *xormStore) UpdateMember(ctx context.Context, cmd *team.UpdateTeamMemberCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return updateTeamMember(sess, cmd.OrgID, cmd.TeamID, cmd.UserID, cmd.Permission)
	})
}

func (ss *xormStore) IsMember(orgId int64, teamId int64, userId int64) (bool, error) {
	var isMember bool

	err := ss.db.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
		var err error
		isMember, err = isTeamMember(sess, orgId, teamId, userId)
		return err
	})

	return isMember, err
}

func isTeamMember(sess *db.Session, orgId int64, teamId int64, userId int64) (bool, error) {
	if res, err := sess.Query("SELECT 1 FROM team_member WHERE org_id=? and team_id=? and user_id=?", orgId, teamId, userId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, nil
	}

	return true, nil
}

// AddOrUpdateTeamMemberHook is called from team resource permission service
// it adds user to a team or updates user permissions in a team within the given transaction session
func AddOrUpdateTeamMemberHook(sess *db.Session, userID, orgID, teamID int64, isExternal bool, permission dashboards.PermissionType) error {
	isMember, err := isTeamMember(sess, orgID, teamID, userID)
	if err != nil {
		return err
	}

	if isMember {
		err = updateTeamMember(sess, orgID, teamID, userID, permission)
	} else {
		err = addTeamMember(sess, orgID, teamID, userID, isExternal, permission)
	}

	return err
}

func addTeamMember(sess *db.Session, orgID, teamID, userID int64, isExternal bool, permission dashboards.PermissionType) error {
	if _, err := teamExists(orgID, teamID, sess); err != nil {
		return err
	}

	entity := team.TeamMember{
		OrgID:      orgID,
		TeamID:     teamID,
		UserID:     userID,
		External:   isExternal,
		Created:    time.Now(),
		Updated:    time.Now(),
		Permission: permission,
	}

	_, err := sess.Insert(&entity)
	return err
}

func updateTeamMember(sess *db.Session, orgID, teamID, userID int64, permission dashboards.PermissionType) error {
	member, err := getTeamMember(sess, orgID, teamID, userID)
	if err != nil {
		return err
	}

	if permission != dashboards.PERMISSION_ADMIN {
		permission = 0 // make sure we don't get invalid permission levels in store
	}

	member.Permission = permission
	_, err = sess.Cols("permission").Where("org_id=? and team_id=? and user_id=?", orgID, teamID, userID).Update(member)
	return err
}

// RemoveTeamMember removes a member from a team
func (ss *xormStore) RemoveMember(ctx context.Context, cmd *team.RemoveTeamMemberCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return removeTeamMember(sess, cmd)
	})
}

// RemoveTeamMemberHook is called from team resource permission service
// it removes a member from a team within the given transaction session
func RemoveTeamMemberHook(sess *db.Session, cmd *team.RemoveTeamMemberCommand) error {
	return removeTeamMember(sess, cmd)
}

func removeTeamMember(sess *db.Session, cmd *team.RemoveTeamMemberCommand) error {
	if _, err := teamExists(cmd.OrgID, cmd.TeamID, sess); err != nil {
		return err
	}

	var rawSQL = "DELETE FROM team_member WHERE org_id=? and team_id=? and user_id=?"
	res, err := sess.Exec(rawSQL, cmd.OrgID, cmd.TeamID, cmd.UserID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if rows == 0 {
		return team.ErrTeamMemberNotFound
	}

	return err
}

// GetUserTeamMemberships return a list of memberships to teams granted to a user
// If external is specified, only memberships provided by an external auth provider will be listed
// This function doesn't perform any accesscontrol filtering.
func (ss *xormStore) GetMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*team.TeamMemberDTO, error) {
	query := &team.GetTeamMembersQuery{
		OrgID:    orgID,
		UserID:   userID,
		External: external,
	}
	queryResult, err := ss.getTeamMembers(ctx, query, nil)
	return queryResult, err
}

// GetTeamMembers return a list of members for the specified team filtered based on the user's permissions
func (ss *xormStore) GetMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	acFilter := &ac.SQLFilter{}
	var err error

	// With accesscontrol we filter out users based on the SignedInUser's permissions
	// Note we assume that checking SignedInUser is allowed to see team members for this team has already been performed
	// If the signed in user is not set no member will be returned
	if !ac.IsDisabled(ss.cfg) {
		sqlID := fmt.Sprintf("%s.%s", ss.db.GetDialect().Quote("user"), ss.db.GetDialect().Quote("id"))
		*acFilter, err = ac.Filter(query.SignedInUser, sqlID, "users:id:", ac.ActionOrgUsersRead)
		if err != nil {
			return nil, err
		}
	}

	return ss.getTeamMembers(ctx, query, acFilter)
}

// getTeamMembers return a list of members for the specified team
func (ss *xormStore) getTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery, acUserFilter *ac.SQLFilter) ([]*team.TeamMemberDTO, error) {
	queryResult := make([]*team.TeamMemberDTO, 0)
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Table("team_member")
		sess.Join("INNER", ss.db.GetDialect().Quote("user"),
			fmt.Sprintf("team_member.user_id=%s.%s", ss.db.GetDialect().Quote("user"), ss.db.GetDialect().Quote("id")),
		)
		sess.Join("INNER", "team", "team.id=team_member.team_id")

		// explicitly check for serviceaccounts
		sess.Where(fmt.Sprintf("%s.is_service_account=?", ss.db.GetDialect().Quote("user")), ss.db.GetDialect().BooleanStr(false))

		if acUserFilter != nil {
			sess.Where(acUserFilter.Where, acUserFilter.Args...)
		}

		// Join with only most recent auth module
		authJoinCondition := `user_auth.id=(
			SELECT id
			FROM user_auth
			WHERE user_auth.user_id = team_member.user_id
			ORDER BY user_auth.created DESC ` +
			ss.db.GetDialect().Limit(1) + ")"
		sess.Join("LEFT", "user_auth", authJoinCondition)

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
			sess.Where("team_member.external=?", ss.db.GetDialect().BooleanStr(true))
		}
		sess.Cols(
			"team_member.org_id",
			"team_member.team_id",
			"team_member.user_id",
			"user.email",
			"user.name",
			"user.login",
			"team_member.external",
			"team_member.permission",
			"user_auth.auth_module",
			"team.uid",
		)
		sess.Asc("user.login", "user.email")

		err := sess.Find(&queryResult)
		return err
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

func (ss *xormStore) IsAdmin(ctx context.Context, query *team.IsAdminOfTeamsQuery) (bool, error) {
	queryResult := false

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sql := `SELECT COUNT(team.id) AS count
			FROM team
			INNER JOIN team_member ON team_member.team_id = team.id
			WHERE team.org_id = ?
				AND team_member.user_id = ?
				AND team_member.permission = ?`
		params := []interface{}{
			query.SignedInUser.OrgID,
			query.SignedInUser.UserID,
			dashboards.PERMISSION_ADMIN,
		}

		type teamCount struct {
			Count int64
		}

		resp := make([]*teamCount, 0)
		if err := sess.SQL(sql, params...).Find(&resp); err != nil {
			return err
		}

		queryResult = len(resp) > 0 && resp[0].Count > 0

		return nil
	})

	return queryResult, err
}

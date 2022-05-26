package sqlstore

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type TeamStore interface {
	UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error
	DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error
	SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error
	GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error
	UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error
	RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error
	GetTeamMembers(ctx context.Context, cmd *models.GetTeamMembersQuery) error
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error)
}

func getFilteredUsers(signedInUser *models.SignedInUser, hiddenUsers map[string]struct{}) []string {
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

func getTeamMemberCount(filteredUsers []string) string {
	if len(filteredUsers) > 0 {
		return `(SELECT COUNT(*) FROM team_member
			INNER JOIN ` + dialect.Quote("user") + ` ON team_member.user_id = ` + dialect.Quote("user") + `.id
			WHERE team_member.team_id = team.id AND ` + dialect.Quote("user") + `.login NOT IN (?` +
			strings.Repeat(",?", len(filteredUsers)-1) + ")" +
			`) AS member_count `
	}

	return "(SELECT COUNT(*) FROM team_member WHERE team_member.team_id = team.id) AS member_count "
}

func getTeamSelectSQLBase(filteredUsers []string) string {
	return `SELECT
		team.id as id,
		team.org_id,
		team.name as name,
		team.email as email, ` +
		getTeamMemberCount(filteredUsers) +
		` FROM team as team `
}

func getTeamSelectWithPermissionsSQLBase(filteredUsers []string) string {
	return `SELECT
		team.id AS id,
		team.org_id,
		team.name AS name,
		team.email AS email,
		team_member.permission, ` +
		getTeamMemberCount(filteredUsers) +
		` FROM team AS team
		INNER JOIN team_member ON team.id = team_member.team_id AND team_member.user_id = ? `
}

func (ss *SQLStore) CreateTeam(name, email string, orgID int64) (models.Team, error) {
	team := models.Team{
		Name:    name,
		Email:   email,
		OrgId:   orgID,
		Created: time.Now(),
		Updated: time.Now(),
	}
	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		if isNameTaken, err := isTeamNameTaken(orgID, name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return models.ErrTeamNameTaken
		}

		_, err := sess.Insert(&team)
		return err
	})
	return team, err
}

func (ss *SQLStore) UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if isNameTaken, err := isTeamNameTaken(cmd.OrgId, cmd.Name, cmd.Id, sess); err != nil {
			return err
		} else if isNameTaken {
			return models.ErrTeamNameTaken
		}

		team := models.Team{
			Name:    cmd.Name,
			Email:   cmd.Email,
			Updated: time.Now(),
		}

		sess.MustCols("email")

		affectedRows, err := sess.ID(cmd.Id).Update(&team)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return models.ErrTeamNotFound
		}

		return nil
	})
}

// DeleteTeam will delete a team, its member and any permissions connected to the team
func (ss *SQLStore) DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if _, err := teamExists(cmd.OrgId, cmd.Id, sess); err != nil {
			return err
		}

		deletes := []string{
			"DELETE FROM team_member WHERE org_id=? and team_id = ?",
			"DELETE FROM team WHERE org_id=? and id = ?",
			"DELETE FROM dashboard_acl WHERE org_id=? and team_id = ?",
			"DELETE FROM team_role WHERE org_id=? and team_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.OrgId, cmd.Id)
			if err != nil {
				return err
			}
		}

		_, err := sess.Exec("DELETE FROM permission WHERE scope=?", ac.Scope("teams", "id", fmt.Sprint(cmd.Id)))

		return err
	})
}

func teamExists(orgID int64, teamID int64, sess *DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", orgID, teamID); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, models.ErrTeamNotFound
	}

	return true, nil
}

func isTeamNameTaken(orgId int64, name string, existingId int64, sess *DBSession) (bool, error) {
	var team models.Team
	exists, err := sess.Where("org_id=? and name=?", orgId, name).Get(&team)
	if err != nil {
		return false, nil
	}

	if exists && existingId != team.Id {
		return true, nil
	}

	return false, nil
}

func (ss *SQLStore) SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		query.Result = models.SearchTeamQueryResult{
			Teams: make([]*models.TeamDTO, 0),
		}
		queryWithWildcards := "%" + query.Query + "%"

		var sql bytes.Buffer
		params := make([]interface{}, 0)

		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		for _, user := range filteredUsers {
			params = append(params, user)
		}

		if query.UserIdFilter == models.FilterIgnoreUser {
			sql.WriteString(getTeamSelectSQLBase(filteredUsers))
		} else {
			sql.WriteString(getTeamSelectWithPermissionsSQLBase(filteredUsers))
			params = append(params, query.UserIdFilter)
		}

		sql.WriteString(` WHERE team.org_id = ?`)
		params = append(params, query.OrgId)

		if query.Query != "" {
			sql.WriteString(` and team.name ` + ss.Dialect.LikeStr() + ` ?`)
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
		if !ac.IsDisabled(ss.Cfg) {
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
			sql.WriteString(ss.Dialect.LimitOffset(int64(query.Limit), int64(offset)))
		}

		if err := sess.SQL(sql.String(), params...).Find(&query.Result.Teams); err != nil {
			return err
		}

		team := models.Team{}
		countSess := sess.Table("team")
		countSess.Where("team.org_id=?", query.OrgId)

		if query.Query != "" {
			countSess.Where(`name `+dialect.LikeStr()+` ?`, queryWithWildcards)
		}

		if query.Name != "" {
			countSess.Where("name=?", query.Name)
		}

		// If we're not retrieving all results, then only search for teams that this user has access to
		if query.UserIdFilter != models.FilterIgnoreUser {
			countSess.
				Where(`
			team.id IN (
				SELECT
				team_id
				FROM team_member
				WHERE team_member.user_id = ?
			)`, query.UserIdFilter)
		}

		// Only count teams user can see
		if !ac.IsDisabled(ss.Cfg) {
			countSess.Where(acFilter.Where, acFilter.Args...)
		}

		count, err := countSess.Count(&team)
		query.Result.TotalCount = count

		return err
	})
}

func (ss *SQLStore) GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		var sql bytes.Buffer
		params := make([]interface{}, 0)

		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		sql.WriteString(getTeamSelectSQLBase(filteredUsers))
		for _, user := range filteredUsers {
			params = append(params, user)
		}

		if query.UserIdFilter != models.FilterIgnoreUser {
			sql.WriteString(` INNER JOIN team_member ON team.id = team_member.team_id AND team_member.user_id = ?`)
			params = append(params, query.UserIdFilter)
		}

		sql.WriteString(` WHERE team.org_id = ? and team.id = ?`)
		params = append(params, query.OrgId, query.Id)

		var team models.TeamDTO
		exists, err := sess.SQL(sql.String(), params...).Get(&team)

		if err != nil {
			return err
		}

		if !exists {
			return models.ErrTeamNotFound
		}

		query.Result = &team
		return nil
	})
}

// GetTeamsByUser is used by the Guardian when checking a users' permissions
func (ss *SQLStore) GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		query.Result = make([]*models.TeamDTO, 0)

		var sql bytes.Buffer

		sql.WriteString(getTeamSelectSQLBase([]string{}))
		sql.WriteString(` INNER JOIN team_member on team.id = team_member.team_id`)
		sql.WriteString(` WHERE team.org_id = ? and team_member.user_id = ?`)

		err := sess.SQL(sql.String(), query.OrgId, query.UserId).Find(&query.Result)
		return err
	})
}

// AddTeamMember adds a user to a team
func (ss *SQLStore) AddTeamMember(userID, orgID, teamID int64, isExternal bool, permission models.PermissionType) error {
	return ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		if isMember, err := isTeamMember(sess, orgID, teamID, userID); err != nil {
			return err
		} else if isMember {
			return models.ErrTeamMemberAlreadyAdded
		}

		return addTeamMember(sess, orgID, teamID, userID, isExternal, permission)
	})
}

func getTeamMember(sess *DBSession, orgId int64, teamId int64, userId int64) (models.TeamMember, error) {
	rawSQL := `SELECT * FROM team_member WHERE org_id=? and team_id=? and user_id=?`
	var member models.TeamMember
	exists, err := sess.SQL(rawSQL, orgId, teamId, userId).Get(&member)

	if err != nil {
		return member, err
	}
	if !exists {
		return member, models.ErrTeamMemberNotFound
	}

	return member, nil
}

// UpdateTeamMember updates a team member
func (ss *SQLStore) UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		return updateTeamMember(sess, cmd.OrgId, cmd.TeamId, cmd.UserId, cmd.Permission)
	})
}

func (ss *SQLStore) IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error) {
	var isMember bool

	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		var err error
		isMember, err = isTeamMember(sess, orgId, teamId, userId)
		return err
	})

	return isMember, err
}

func isTeamMember(sess *DBSession, orgId int64, teamId int64, userId int64) (bool, error) {
	if res, err := sess.Query("SELECT 1 FROM team_member WHERE org_id=? and team_id=? and user_id=?", orgId, teamId, userId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, nil
	}

	return true, nil
}

// AddOrUpdateTeamMemberHook is called from team resource permission service
// it adds user to a team or updates user permissions in a team within the given transaction session
func AddOrUpdateTeamMemberHook(sess *DBSession, userID, orgID, teamID int64, isExternal bool, permission models.PermissionType) error {
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

func addTeamMember(sess *DBSession, orgID, teamID, userID int64, isExternal bool, permission models.PermissionType) error {
	if _, err := teamExists(orgID, teamID, sess); err != nil {
		return err
	}

	entity := models.TeamMember{
		OrgId:      orgID,
		TeamId:     teamID,
		UserId:     userID,
		External:   isExternal,
		Created:    time.Now(),
		Updated:    time.Now(),
		Permission: permission,
	}

	_, err := sess.Insert(&entity)
	return err
}

func updateTeamMember(sess *DBSession, orgID, teamID, userID int64, permission models.PermissionType) error {
	member, err := getTeamMember(sess, orgID, teamID, userID)
	if err != nil {
		return err
	}

	if permission != models.PERMISSION_ADMIN {
		permission = 0 // make sure we don't get invalid permission levels in store

		// protect the last team admin
		_, err := isLastAdmin(sess, orgID, teamID, userID)
		if err != nil {
			return err
		}
	}

	member.Permission = permission
	_, err = sess.Cols("permission").Where("org_id=? and team_id=? and user_id=?", orgID, teamID, userID).Update(member)
	return err
}

// RemoveTeamMember removes a member from a team
func (ss *SQLStore) RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		return removeTeamMember(sess, cmd)
	})
}

// RemoveTeamMemberHook is called from team resource permission service
// it removes a member from a team within the given transaction session
func RemoveTeamMemberHook(sess *DBSession, cmd *models.RemoveTeamMemberCommand) error {
	return removeTeamMember(sess, cmd)
}

func removeTeamMember(sess *DBSession, cmd *models.RemoveTeamMemberCommand) error {
	if _, err := teamExists(cmd.OrgId, cmd.TeamId, sess); err != nil {
		return err
	}

	_, err := isLastAdmin(sess, cmd.OrgId, cmd.TeamId, cmd.UserId)
	if err != nil {
		return err
	}

	var rawSQL = "DELETE FROM team_member WHERE org_id=? and team_id=? and user_id=?"
	res, err := sess.Exec(rawSQL, cmd.OrgId, cmd.TeamId, cmd.UserId)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if rows == 0 {
		return models.ErrTeamMemberNotFound
	}

	return err
}

func isLastAdmin(sess *DBSession, orgId int64, teamId int64, userId int64) (bool, error) {
	rawSQL := "SELECT user_id FROM team_member WHERE org_id=? and team_id=? and permission=?"
	userIds := []*int64{}
	err := sess.SQL(rawSQL, orgId, teamId, models.PERMISSION_ADMIN).Find(&userIds)
	if err != nil {
		return false, err
	}

	isAdmin := false
	for _, adminId := range userIds {
		if userId == *adminId {
			isAdmin = true
			break
		}
	}

	if isAdmin && len(userIds) == 1 {
		return true, models.ErrLastTeamAdmin
	}

	return false, err
}

// GetUserTeamMemberships return a list of memberships to teams granted to a user
// If external is specified, only memberships provided by an external auth provider will be listed
// This function doesn't perform any accesscontrol filtering.
func (ss *SQLStore) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error) {
	query := &models.GetTeamMembersQuery{
		OrgId:    orgID,
		UserId:   userID,
		External: external,
		Result:   []*models.TeamMemberDTO{},
	}
	err := ss.getTeamMembers(ctx, query, nil)
	return query.Result, err
}

// GetTeamMembers return a list of members for the specified team filtered based on the user's permissions
func (ss *SQLStore) GetTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery) error {
	acFilter := &ac.SQLFilter{}
	var err error

	// With accesscontrol we filter out users based on the SignedInUser's permissions
	// Note we assume that checking SignedInUser is allowed to see team members for this team has already been performed
	// If the signed in user is not set no member will be returned
	if !ac.IsDisabled(ss.Cfg) {
		sqlID := fmt.Sprintf("%s.%s", ss.engine.Dialect().Quote("user"), ss.engine.Dialect().Quote("id"))
		*acFilter, err = ac.Filter(query.SignedInUser, sqlID, "users:id:", ac.ActionOrgUsersRead)
		if err != nil {
			return err
		}
	}

	return ss.getTeamMembers(ctx, query, acFilter)
}

// getTeamMembers return a list of members for the specified team
func (ss *SQLStore) getTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery, acUserFilter *ac.SQLFilter) error {
	return ss.WithDbSession(ctx, func(dbSess *DBSession) error {
		query.Result = make([]*models.TeamMemberDTO, 0)
		sess := dbSess.Table("team_member")
		sess.Join("INNER", ss.Dialect.Quote("user"),
			fmt.Sprintf("team_member.user_id=%s.%s", ss.Dialect.Quote("user"), ss.Dialect.Quote("id")),
		)

		// explicitly check for serviceaccounts
		sess.Where(fmt.Sprintf("%s.is_service_account=?", ss.Dialect.Quote("user")), ss.Dialect.BooleanStr(false))

		if acUserFilter != nil {
			sess.Where(acUserFilter.Where, acUserFilter.Args...)
		}

		// Join with only most recent auth module
		authJoinCondition := `(
		SELECT id from user_auth
			WHERE user_auth.user_id = team_member.user_id
			ORDER BY user_auth.created DESC `
		authJoinCondition = "user_auth.id=" + authJoinCondition + ss.Dialect.Limit(1) + ")"
		sess.Join("LEFT", "user_auth", authJoinCondition)

		if query.OrgId != 0 {
			sess.Where("team_member.org_id=?", query.OrgId)
		}
		if query.TeamId != 0 {
			sess.Where("team_member.team_id=?", query.TeamId)
		}
		if query.UserId != 0 {
			sess.Where("team_member.user_id=?", query.UserId)
		}
		if query.External {
			sess.Where("team_member.external=?", ss.Dialect.BooleanStr(true))
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
		)
		sess.Asc("user.login", "user.email")

		err := sess.Find(&query.Result)
		return err
	})
}

func (ss *SQLStore) IsAdminOfTeams(ctx context.Context, query *models.IsAdminOfTeamsQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		builder := &SQLBuilder{}
		builder.Write("SELECT COUNT(team.id) AS count FROM team INNER JOIN team_member ON team_member.team_id = team.id WHERE team.org_id = ? AND team_member.user_id = ? AND team_member.permission = ?", query.SignedInUser.OrgId, query.SignedInUser.UserId, models.PERMISSION_ADMIN)

		type teamCount struct {
			Count int64
		}

		resp := make([]*teamCount, 0)
		if err := sess.SQL(builder.GetSQLString(), builder.params...).Find(&resp); err != nil {
			return err
		}

		query.Result = len(resp) > 0 && resp[0].Count > 0

		return nil
	})
}

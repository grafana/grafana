package teamimpl

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamdelete"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
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
	cfg             *setting.Cfg
	deleteRenderers []teamdelete.Renderer
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

func getTeamMemberCount(dbHelper *legacysql.LegacyDatabaseHelper, filteredUsers []string) string {
	teamMemberTable := dbHelper.DB.Quote(dbHelper.Table("team_member"))
	if len(filteredUsers) > 0 {
		userTable := dbHelper.DB.Quote(dbHelper.Table("user"))
		return `(SELECT COUNT(*) FROM ` + teamMemberTable + ` AS team_member
			INNER JOIN ` + userTable + ` ON team_member.user_id = ` + userTable + `.id
			WHERE team_member.team_id = team.id AND ` + userTable + `.login NOT IN (?` +
			strings.Repeat(",?", len(filteredUsers)-1) + ")" +
			`) AS member_count `
	}

	return "(SELECT COUNT(*) FROM " + teamMemberTable + " AS team_member WHERE team_member.team_id = team.id) AS member_count "
}

func getTeamSelectSQLBase(dbHelper *legacysql.LegacyDatabaseHelper, filteredUsers []string) string {
	teamTable := dbHelper.DB.Quote(dbHelper.Table("team"))
	return `SELECT
		team.id as id,
		team.uid,
		team.org_id,
		team.name as name,
		team.email as email,
		team.external_uid as external_uid,
		team.is_provisioned as is_provisioned, ` +
		getTeamMemberCount(dbHelper, filteredUsers) +
		` FROM ` + teamTable + ` AS team `
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
		if isNameTaken, err := isTeamNameTaken(dbHelper.Table("team"), cmd.OrgID, cmd.Name, 0, sess); err != nil {
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
		if isNameTaken, err := isTeamNameTaken(dbHelper.Table("team"), cmd.OrgID, cmd.Name, cmd.ID, sess); err != nil {
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

func getTeamDeleteQueries(dbHelper *legacysql.LegacyDatabaseHelper) []string {
	return []string{
		"DELETE FROM " + dbHelper.DB.Quote(dbHelper.Table("team_member")) + " WHERE org_id=? and team_id = ?",
		"DELETE FROM " + dbHelper.DB.Quote(dbHelper.Table("team")) + " WHERE org_id=? and id = ?",
		"DELETE FROM " + dbHelper.DB.Quote(dbHelper.Table("dashboard_acl")) + " WHERE org_id=? and team_id = ?",
	}
}

// DeleteTeam will delete a team, its member and any permissions connected to the team
func (ss *xormStore) Delete(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := teamExists(dbHelper, cmd.OrgID, cmd.ID, sess); err != nil {
			return err
		}

		for _, sql := range getTeamDeleteQueries(dbHelper) {
			_, err := sess.Exec(sql, cmd.OrgID, cmd.ID)
			if err != nil {
				return err
			}
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

func teamExists(dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, teamID int64, sess *db.Session) (bool, error) {
	query := "SELECT 1 FROM " + dbHelper.DB.Quote(dbHelper.Table("team")) + " WHERE org_id=? and id=?"
	if res, err := sess.Query(query, orgID, teamID); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, team.ErrTeamNotFound
	}

	return true, nil
}

func isTeamNameTaken(teamTable string, orgId int64, name string, existingId int64, sess *db.Session) (bool, error) {
	var team team.Team
	exists, err := sess.Table(teamTable).Where("org_id=? and name=?", orgId, name).Get(&team)
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

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return queryResult, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		var sql bytes.Buffer
		params := make([]any, 0)

		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		for _, user := range filteredUsers {
			params = append(params, user)
		}

		sql.WriteString(getTeamSelectSQLBase(dbHelper, filteredUsers))
		sql.WriteString(` WHERE team.org_id = ?`)
		params = append(params, query.OrgID)

		if query.Query != "" {
			like, param := dbHelper.DB.GetDialect().LikeOperator("team.name", true, query.Query, true)
			sql.WriteString(" and " + like)
			params = append(params, param)
		}

		if query.Name != "" {
			sql.WriteString(` and LOWER(team.name) = LOWER(?)`)
			params = append(params, query.Name)
		}

		if len(query.TeamIds) > 0 {
			sql.WriteString(` and team.id IN (?` + strings.Repeat(",?", len(query.TeamIds)-1) + ")")
			for _, id := range query.TeamIds {
				params = append(params, id)
			}
		}

		if len(query.UIDs) > 0 {
			sql.WriteString(` and team.uid IN (?` + strings.Repeat(",?", len(query.UIDs)-1) + ")")
			for _, uid := range query.UIDs {
				params = append(params, uid)
			}
		}

		acFilter, err := ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
		if err != nil {
			return err
		}
		sql.WriteString(` and` + acFilter.Where)
		params = append(params, acFilter.Args...)

		if len(query.SortOpts) > 0 {
			orderBy := ` order by `
			for i := range query.SortOpts {
				for j := range query.SortOpts[i].Filter {
					orderBy += query.SortOpts[i].Filter[j].OrderBy() + ","
				}
			}
			sql.WriteString(orderBy[:len(orderBy)-1])
		} else {
			sql.WriteString(` order by team.name asc`)
		}

		if query.Limit != 0 {
			offset := query.Limit * (query.Page - 1)
			sql.WriteString(dbHelper.DB.GetDialect().LimitOffset(int64(query.Limit), int64(offset)))
		}

		if err := sess.SQL(sql.String(), params...).Find(&queryResult.Teams); err != nil {
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
		var sql bytes.Buffer
		params := make([]any, 0)

		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		sql.WriteString(getTeamSelectSQLBase(dbHelper, filteredUsers))
		for _, user := range filteredUsers {
			params = append(params, user)
		}

		// Prioritize ID over UID
		if query.ID != 0 {
			sql.WriteString(` WHERE team.org_id = ? and team.id = ?`)
			params = append(params, query.OrgID, query.ID)
		} else {
			sql.WriteString(` WHERE team.org_id = ? and team.uid = ?`)
			params = append(params, query.OrgID, query.UID)
		}

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
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		var sql bytes.Buffer
		var params []any
		params = append(params, query.OrgID, query.UserID)

		sql.WriteString(getTeamSelectSQLBase(dbHelper, []string{}))
		sql.WriteString(` INNER JOIN ` + dbHelper.DB.Quote(dbHelper.Table("team_member")) + ` AS team_member on team.id = team_member.team_id`)
		sql.WriteString(` WHERE team.org_id = ? and team_member.user_id = ?`)

		acFilter, err := ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
		if err != nil {
			return err
		}
		sql.WriteString(` and` + acFilter.Where)
		params = append(params, acFilter.Args...)

		err = sess.SQL(sql.String(), params...).Find(&queryResult)
		return err
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

// GetIDsByUser returns a list of team IDs for the given user
func (ss *xormStore) GetIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, []string, error) {
	ids := make([]int64, 0)
	uids := make([]string, 0)

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, nil, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		teamMemberTable := dbHelper.DB.Quote(dbHelper.Table("team_member"))
		teamTable := dbHelper.DB.Quote(dbHelper.Table("team"))
		rows, err := sess.QueryRows(`SELECT tm.team_id, team.uid
			FROM `+teamMemberTable+` AS tm
			JOIN `+teamTable+` AS team ON team.id = tm.team_id
			WHERE tm.user_id=? AND tm.org_id=?
			ORDER BY tm.team_id asc`, query.UserID, query.OrgID)
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

func getTeamMember(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgId int64, teamId int64, userId int64) (team.TeamMember, error) {
	rawSQL := `SELECT * FROM ` + dbHelper.DB.Quote(dbHelper.Table("team_member")) + ` WHERE org_id=? and team_id=? and user_id=?`
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
	query := "SELECT 1 FROM " + dbHelper.DB.Quote(dbHelper.Table("team_member")) + " WHERE org_id=? and team_id=? and user_id=?"
	if res, err := sess.Query(query, orgId, teamId, userId); err != nil {
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
	if _, err := teamExists(dbHelper, orgID, teamID, sess); err != nil {
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

func removeTeamMember(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, cmd *team.RemoveTeamMemberCommand) error {
	if _, err := teamExists(dbHelper, cmd.OrgID, cmd.TeamID, sess); err != nil {
		return err
	}

	var rawSQL = "DELETE FROM " + dbHelper.DB.Quote(dbHelper.Table("team_member")) + " WHERE org_id=? and team_id=? and user_id=?"
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

// RemoveUsersMemberships removes all the team membership entries for the given user.
// Only used when removing a user from a Grafana instance.
func (ss *xormStore) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "DELETE FROM " + dbHelper.DB.Quote(dbHelper.Table("team_member")) + " WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
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
		userTable := dbHelper.DB.Quote(dbHelper.Table("user"))
		teamTable := dbHelper.DB.Quote(dbHelper.Table("team"))
		userAuthTable := dbHelper.DB.Quote(dbHelper.Table("user_auth"))
		sess := dbSess.Table(dbHelper.Table("team_member"))
		sess.Join("INNER", userTable,
			fmt.Sprintf("team_member.user_id=%s.%s", userTable, dbHelper.DB.GetDialect().Quote("id")),
		)
		sess.Join("INNER", teamTable, "team.id=team_member.team_id")

		// explicitly check for serviceaccounts
		sess.Where(fmt.Sprintf("%s.is_service_account=?", userTable), dbHelper.DB.GetDialect().BooleanValue(false))

		if acUserFilter != nil {
			sess.Where(acUserFilter.Where, acUserFilter.Args...)
		}

		// Join with only most recent auth module
		authJoinCondition := `user_auth.id=(
			SELECT id
			FROM ` + userAuthTable + ` AS user_auth
			WHERE user_auth.user_id = team_member.user_id
			ORDER BY user_auth.created DESC ` +
			dbHelper.DB.GetDialect().Limit(1) + ")"
		sess.Join("LEFT", userAuthTable, authJoinCondition)

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
			team.uid as team_uid`, dbHelper.DB.GetDialect().Quote("user")))
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

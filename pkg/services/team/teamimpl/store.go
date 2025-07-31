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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type store interface {
	Create(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error)
	Update(ctx context.Context, cmd *team.UpdateTeamCommand) error
	Delete(ctx context.Context, cmd *team.DeleteTeamCommand) error
	Search(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error)
	GetByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error)
	GetByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error)
	GetIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, error)
	RemoveUsersMemberships(ctx context.Context, userID int64) error
	IsMember(orgId int64, teamId int64, userId int64) (bool, error)
	GetMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*team.TeamMemberDTO, error)
	GetMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error)
	RegisterDelete(query string)
}

type xormStore struct {
	db               db.DB
	settingsProvider setting.SettingsProvider
	deletes          []string
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
		team.email as email,
		team.external_uid as external_uid,
		team.is_provisioned as is_provisioned, ` +
		getTeamMemberCount(db, filteredUsers) +
		` FROM team as team `
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
	err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isTeamNameTaken(cmd.OrgID, cmd.Name, 0, sess); err != nil {
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
			Name:        cmd.Name,
			Email:       cmd.Email,
			ExternalUID: cmd.ExternalUID,
			Updated:     time.Now(),
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
		}

		deletes = append(deletes, ss.deletes...)

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.OrgID, cmd.ID)
			if err != nil {
				return err
			}
		}
		return nil
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
		var sql bytes.Buffer
		params := make([]any, 0)

		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		for _, user := range filteredUsers {
			params = append(params, user)
		}

		sql.WriteString(getTeamSelectSQLBase(ss.db, filteredUsers))
		sql.WriteString(` WHERE team.org_id = ?`)
		params = append(params, query.OrgID)

		if query.Query != "" {
			like, param := ss.db.GetDialect().LikeOperator("team.name", true, query.Query, true)
			sql.WriteString(" and " + like)
			params = append(params, param)
		}

		if query.Name != "" {
			sql.WriteString(` and team.name = ?`)
			params = append(params, query.Name)
		}

		if len(query.TeamIds) > 0 {
			sql.WriteString(` and team.id IN (?` + strings.Repeat(",?", len(query.TeamIds)-1) + ")")
			for _, id := range query.TeamIds {
				params = append(params, id)
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
			sql.WriteString(ss.db.GetDialect().LimitOffset(int64(query.Limit), int64(offset)))
		}

		if err := sess.SQL(sql.String(), params...).Find(&queryResult.Teams); err != nil {
			return err
		}

		t := team.Team{}
		countSess := sess.Table("team")
		countSess.Where("team.org_id=?", query.OrgID)

		if query.Query != "" {
			like, param := ss.db.GetDialect().LikeOperator("name", true, query.Query, true)
			countSess.Where(like, param)
		}

		if query.Name != "" {
			countSess.Where("name=?", query.Name)
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

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var sql bytes.Buffer
		params := make([]any, 0)

		filteredUsers := getFilteredUsers(query.SignedInUser, query.HiddenUsers)
		sql.WriteString(getTeamSelectSQLBase(ss.db, filteredUsers))
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
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var sql bytes.Buffer
		var params []any
		params = append(params, query.OrgID, query.UserID)

		sql.WriteString(getTeamSelectSQLBase(ss.db, []string{}))
		sql.WriteString(` INNER JOIN team_member on team.id = team_member.team_id`)
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
func (ss *xormStore) GetIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, error) {
	queryResult := make([]int64, 0)

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(`SELECT tm.team_id
FROM team_member as tm
WHERE tm.user_id=? AND tm.org_id=?;`, query.UserID, query.OrgID).Find(&queryResult)
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get team IDs by user: %w", err)
	}

	return queryResult, nil
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

func (ss *xormStore) IsMember(orgId int64, teamId int64, userId int64) (bool, error) {
	var isMember bool

	err := ss.db.WithDbSession(context.Background(), func(sess *db.Session) error {
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
func AddOrUpdateTeamMemberHook(sess *db.Session, userID, orgID, teamID int64, isExternal bool, permission team.PermissionType) error {
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

func addTeamMember(sess *db.Session, orgID, teamID, userID int64, isExternal bool, permission team.PermissionType) error {
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

func updateTeamMember(sess *db.Session, orgID, teamID, userID int64, permission team.PermissionType) error {
	member, err := getTeamMember(sess, orgID, teamID, userID)
	if err != nil {
		return err
	}

	if permission != team.PermissionTypeAdmin {
		permission = team.PermissionTypeMember // make sure we don't get invalid permission levels in store
	}

	member.Permission = permission
	_, err = sess.Cols("permission").Where("org_id=? and team_id=? and user_id=?", orgID, teamID, userID).Update(member)
	return err
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

	rawSQL := "DELETE FROM team_member WHERE org_id=? and team_id=? and user_id=?"
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
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "DELETE FROM team_member WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
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
	sqlID := fmt.Sprintf("%s.%s", ss.db.GetDialect().Quote("user"), ss.db.GetDialect().Quote("id"))
	*acFilter, err = ac.Filter(query.SignedInUser, sqlID, "users:id:", ac.ActionOrgUsersRead)
	if err != nil {
		return nil, err
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
		sess.Where(fmt.Sprintf("%s.is_service_account=?", ss.db.GetDialect().Quote("user")), ss.db.GetDialect().BooleanValue(false))

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
			sess.Where("team_member.external=?", ss.db.GetDialect().BooleanValue(true))
		}
		sess.Select(fmt.Sprintf(`team_member.org_id,
			team_member.team_id,
			team_member.user_id,
			%[1]s.email,
			%[1]s.name,
			%[1]s.login,
			%[1]s.uid as user_uid,
			team_member.external,
			team_member.permission,
			user_auth.auth_module,
			team.uid`, ss.db.GetDialect().Quote("user")))
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

package sqlstore

import (
	"bytes"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreateTeam)
	bus.AddHandler("sql", UpdateTeam)
	bus.AddHandler("sql", DeleteTeam)
	bus.AddHandler("sql", SearchTeams)
	bus.AddHandler("sql", GetTeamById)
	bus.AddHandler("sql", GetTeamsByUser)

	bus.AddHandler("sql", AddTeamMember)
	bus.AddHandler("sql", UpdateTeamMember)
	bus.AddHandler("sql", RemoveTeamMember)
	bus.AddHandler("sql", GetTeamMembers)
}

func getTeamSearchSqlBase() string {
	return `SELECT
		team.id as id,
		team.org_id,
		team.name as name,
		team.email as email,
		(SELECT COUNT(*) from team_member where team_member.team_id = team.id) as member_count,
		team_member.permission
		FROM team as team
		INNER JOIN team_member on team.id = team_member.team_id AND team_member.user_id = ? `
}

func getTeamSelectSqlBase() string {
	return `SELECT
		team.id as id,
		team.org_id,
		team.name as name,
		team.email as email,
		(SELECT COUNT(*) from team_member where team_member.team_id = team.id) as member_count 
		FROM team as team `
}

func CreateTeam(cmd *m.CreateTeamCommand) error {
	return inTransaction(func(sess *DBSession) error {

		if isNameTaken, err := isTeamNameTaken(cmd.OrgId, cmd.Name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return m.ErrTeamNameTaken
		}

		team := m.Team{
			Name:    cmd.Name,
			Email:   cmd.Email,
			OrgId:   cmd.OrgId,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&team)

		cmd.Result = team

		return err
	})
}

func UpdateTeam(cmd *m.UpdateTeamCommand) error {
	return inTransaction(func(sess *DBSession) error {

		if isNameTaken, err := isTeamNameTaken(cmd.OrgId, cmd.Name, cmd.Id, sess); err != nil {
			return err
		} else if isNameTaken {
			return m.ErrTeamNameTaken
		}

		team := m.Team{
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
			return m.ErrTeamNotFound
		}

		return nil
	})
}

// DeleteTeam will delete a team, its member and any permissions connected to the team
func DeleteTeam(cmd *m.DeleteTeamCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if _, err := teamExists(cmd.OrgId, cmd.Id, sess); err != nil {
			return err
		}

		deletes := []string{
			"DELETE FROM team_member WHERE org_id=? and team_id = ?",
			"DELETE FROM team WHERE org_id=? and id = ?",
			"DELETE FROM dashboard_acl WHERE org_id=? and team_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.OrgId, cmd.Id)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func teamExists(orgId int64, teamId int64, sess *DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", orgId, teamId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, m.ErrTeamNotFound
	}

	return true, nil
}

func isTeamNameTaken(orgId int64, name string, existingId int64, sess *DBSession) (bool, error) {
	var team m.Team
	exists, err := sess.Where("org_id=? and name=?", orgId, name).Get(&team)

	if err != nil {
		return false, nil
	}

	if exists && existingId != team.Id {
		return true, nil
	}

	return false, nil
}

func SearchTeams(query *m.SearchTeamsQuery) error {
	query.Result = m.SearchTeamQueryResult{
		Teams: make([]*m.TeamDTO, 0),
	}
	queryWithWildcards := "%" + query.Query + "%"

	var sql bytes.Buffer
	params := make([]interface{}, 0)

	if query.UserIdFilter > 0 {
		sql.WriteString(getTeamSearchSqlBase())
		params = append(params, query.UserIdFilter)
	} else {
		sql.WriteString(getTeamSelectSqlBase())
	}
	sql.WriteString(` WHERE team.org_id = ?`)

	params = append(params, query.OrgId)

	if query.Query != "" {
		sql.WriteString(` and team.name ` + dialect.LikeStr() + ` ?`)
		params = append(params, queryWithWildcards)
	}

	if query.Name != "" {
		sql.WriteString(` and team.name = ?`)
		params = append(params, query.Name)
	}

	sql.WriteString(` order by team.name asc`)

	if query.Limit != 0 {
		offset := query.Limit * (query.Page - 1)
		sql.WriteString(dialect.LimitOffset(int64(query.Limit), int64(offset)))
	}

	if err := x.SQL(sql.String(), params...).Find(&query.Result.Teams); err != nil {
		return err
	}

	team := m.Team{}
	countSess := x.Table("team")
	if query.Query != "" {
		countSess.Where(`name `+dialect.LikeStr()+` ?`, queryWithWildcards)
	}

	if query.Name != "" {
		countSess.Where("name=?", query.Name)
	}

	count, err := countSess.Count(&team)
	query.Result.TotalCount = count

	return err
}

func GetTeamById(query *m.GetTeamByIdQuery) error {
	var sql bytes.Buffer

	sql.WriteString(getTeamSelectSqlBase())
	sql.WriteString(` WHERE team.org_id = ? and team.id = ?`)

	var team m.TeamDTO
	exists, err := x.SQL(sql.String(), query.OrgId, query.Id).Get(&team)

	if err != nil {
		return err
	}

	if !exists {
		return m.ErrTeamNotFound
	}

	query.Result = &team
	return nil
}

// GetTeamsByUser is used by the Guardian when checking a users' permissions
func GetTeamsByUser(query *m.GetTeamsByUserQuery) error {
	query.Result = make([]*m.TeamDTO, 0)

	var sql bytes.Buffer

	sql.WriteString(getTeamSelectSqlBase())
	sql.WriteString(` INNER JOIN team_member on team.id = team_member.team_id`)
	sql.WriteString(` WHERE team.org_id = ? and team_member.user_id = ?`)

	err := x.SQL(sql.String(), query.OrgId, query.UserId).Find(&query.Result)
	return err
}

// AddTeamMember adds a user to a team
func AddTeamMember(cmd *m.AddTeamMemberCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if res, err := sess.Query("SELECT 1 from team_member WHERE org_id=? and team_id=? and user_id=?", cmd.OrgId, cmd.TeamId, cmd.UserId); err != nil {
			return err
		} else if len(res) == 1 {
			return m.ErrTeamMemberAlreadyAdded
		}

		if _, err := teamExists(cmd.OrgId, cmd.TeamId, sess); err != nil {
			return err
		}

		entity := m.TeamMember{
			OrgId:      cmd.OrgId,
			TeamId:     cmd.TeamId,
			UserId:     cmd.UserId,
			External:   cmd.External,
			Created:    time.Now(),
			Updated:    time.Now(),
			Permission: cmd.Permission,
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func getTeamMember(sess *DBSession, orgId int64, teamId int64, userId int64) (m.TeamMember, error) {
	rawSql := `SELECT * FROM team_member WHERE org_id=? and team_id=? and user_id=?`
	var member m.TeamMember
	exists, err := sess.SQL(rawSql, orgId, teamId, userId).Get(&member)

	if err != nil {
		return member, err
	}
	if !exists {
		return member, m.ErrTeamMemberNotFound
	}

	return member, nil
}

// UpdateTeamMember updates a team member
func UpdateTeamMember(cmd *m.UpdateTeamMemberCommand) error {
	return inTransaction(func(sess *DBSession) error {
		member, err := getTeamMember(sess, cmd.OrgId, cmd.TeamId, cmd.UserId)
		if err != nil {
			return err
		}

		if cmd.ProtectLastAdmin {
			_, err := isLastAdmin(sess, cmd.OrgId, cmd.TeamId, cmd.UserId)
			if err != nil {
				return err
			}
		}

		if cmd.Permission != m.PERMISSION_ADMIN { // make sure we don't get invalid permission levels in store
			cmd.Permission = 0
		}

		member.Permission = cmd.Permission
		_, err = sess.Cols("permission").Where("org_id=? and team_id=? and user_id=?", cmd.OrgId, cmd.TeamId, cmd.UserId).Update(member)

		return err
	})
}

// RemoveTeamMember removes a member from a team
func RemoveTeamMember(cmd *m.RemoveTeamMemberCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if _, err := teamExists(cmd.OrgId, cmd.TeamId, sess); err != nil {
			return err
		}

		if cmd.ProtectLastAdmin {
			_, err := isLastAdmin(sess, cmd.OrgId, cmd.TeamId, cmd.UserId)
			if err != nil {
				return err
			}
		}

		var rawSql = "DELETE FROM team_member WHERE org_id=? and team_id=? and user_id=?"
		res, err := sess.Exec(rawSql, cmd.OrgId, cmd.TeamId, cmd.UserId)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if rows == 0 {
			return m.ErrTeamMemberNotFound
		}

		return err
	})
}

func isLastAdmin(sess *DBSession, orgId int64, teamId int64, userId int64) (bool, error) {
	rawSql := "SELECT user_id FROM team_member WHERE org_id=? and team_id=? and permission=?"
	userIds := []*int64{}
	err := sess.SQL(rawSql, orgId, teamId, m.PERMISSION_ADMIN).Find(&userIds)
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
		return true, m.ErrLastTeamAdmin
	}

	return false, err
}

// GetTeamMembers return a list of members for the specified team
func GetTeamMembers(query *m.GetTeamMembersQuery) error {
	query.Result = make([]*m.TeamMemberDTO, 0)
	sess := x.Table("team_member")
	sess.Join("INNER", x.Dialect().Quote("user"), fmt.Sprintf("team_member.user_id=%s.id", x.Dialect().Quote("user")))
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
		sess.Where("team_member.external=?", dialect.BooleanStr(true))
	}
	sess.Cols("team_member.org_id", "team_member.team_id", "team_member.user_id", "user.email", "user.login", "team_member.external", "team_member.permission")
	sess.Asc("user.login", "user.email")

	err := sess.Find(&query.Result)
	return err
}

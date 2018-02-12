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
	bus.AddHandler("sql", RemoveTeamMember)
	bus.AddHandler("sql", GetTeamMembers)
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

		affectedRows, err := sess.Id(cmd.Id).Update(&team)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return m.ErrTeamNotFound
		}

		return nil
	})
}

func DeleteTeam(cmd *m.DeleteTeamCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", cmd.OrgId, cmd.Id); err != nil {
			return err
		} else if len(res) != 1 {
			return m.ErrTeamNotFound
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
		Teams: make([]*m.SearchTeamDto, 0),
	}
	queryWithWildcards := "%" + query.Query + "%"

	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`select
		team.id as id,
		team.org_id,
		team.name as name,
		team.email as email,
		(select count(*) from team_member where team_member.team_id = team.id) as member_count
		from team as team
		where team.org_id = ?`)

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
		sql.WriteString(` limit ? offset ?`)
		offset := query.Limit * (query.Page - 1)
		params = append(params, query.Limit, offset)
	}

	if err := x.Sql(sql.String(), params...).Find(&query.Result.Teams); err != nil {
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
	var team m.Team
	exists, err := x.Where("org_id=? and id=?", query.OrgId, query.Id).Get(&team)
	if err != nil {
		return err
	}

	if !exists {
		return m.ErrTeamNotFound
	}

	query.Result = &team
	return nil
}

func GetTeamsByUser(query *m.GetTeamsByUserQuery) error {
	query.Result = make([]*m.Team, 0)

	sess := x.Table("team")
	sess.Join("INNER", "team_member", "team.id=team_member.team_id")
	sess.Where("team.org_id=? and team_member.user_id=?", query.OrgId, query.UserId)

	err := sess.Find(&query.Result)
	if err != nil {
		return err
	}

	return nil
}

func AddTeamMember(cmd *m.AddTeamMemberCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if res, err := sess.Query("SELECT 1 from team_member WHERE org_id=? and team_id=? and user_id=?", cmd.OrgId, cmd.TeamId, cmd.UserId); err != nil {
			return err
		} else if len(res) == 1 {
			return m.ErrTeamMemberAlreadyAdded
		}

		if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", cmd.OrgId, cmd.TeamId); err != nil {
			return err
		} else if len(res) != 1 {
			return m.ErrTeamNotFound
		}

		entity := m.TeamMember{
			OrgId:   cmd.OrgId,
			TeamId:  cmd.TeamId,
			UserId:  cmd.UserId,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func RemoveTeamMember(cmd *m.RemoveTeamMemberCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM team_member WHERE org_id=? and team_id=? and user_id=?"
		_, err := sess.Exec(rawSql, cmd.OrgId, cmd.TeamId, cmd.UserId)
		if err != nil {
			return err
		}

		return err
	})
}

func GetTeamMembers(query *m.GetTeamMembersQuery) error {
	query.Result = make([]*m.TeamMemberDTO, 0)
	sess := x.Table("team_member")
	sess.Join("INNER", "user", fmt.Sprintf("team_member.user_id=%s.id", x.Dialect().Quote("user")))
	sess.Where("team_member.org_id=? and team_member.team_id=?", query.OrgId, query.TeamId)
	sess.Cols("user.org_id", "team_member.team_id", "team_member.user_id", "user.email", "user.login")
	sess.Asc("user.login", "user.email")

	err := sess.Find(&query.Result)
	return err
}

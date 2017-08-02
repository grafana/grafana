package sqlstore

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreateUserGroup)
	bus.AddHandler("sql", UpdateUserGroup)
	bus.AddHandler("sql", DeleteUserGroup)
	bus.AddHandler("sql", SearchUserGroups)
	bus.AddHandler("sql", GetUserGroupById)
	bus.AddHandler("sql", GetUserGroupsByUser)

	bus.AddHandler("sql", AddUserGroupMember)
	bus.AddHandler("sql", RemoveUserGroupMember)
	bus.AddHandler("sql", GetUserGroupMembers)
}

func CreateUserGroup(cmd *m.CreateUserGroupCommand) error {
	return inTransaction(func(sess *DBSession) error {

		if isNameTaken, err := isUserGroupNameTaken(cmd.Name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return m.ErrUserGroupNameTaken
		}

		userGroup := m.UserGroup{
			Name:    cmd.Name,
			OrgId:   cmd.OrgId,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&userGroup)

		cmd.Result = userGroup

		return err
	})
}

func UpdateUserGroup(cmd *m.UpdateUserGroupCommand) error {
	return inTransaction(func(sess *DBSession) error {

		if isNameTaken, err := isUserGroupNameTaken(cmd.Name, cmd.Id, sess); err != nil {
			return err
		} else if isNameTaken {
			return m.ErrUserGroupNameTaken
		}

		userGroup := m.UserGroup{
			Name:    cmd.Name,
			Updated: time.Now(),
		}

		affectedRows, err := sess.Id(cmd.Id).Update(&userGroup)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return m.ErrUserGroupNotFound
		}

		return nil
	})
}

func DeleteUserGroup(cmd *m.DeleteUserGroupCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if res, err := sess.Query("SELECT 1 from user_group WHERE id=?", cmd.Id); err != nil {
			return err
		} else if len(res) != 1 {
			return m.ErrUserGroupNotFound
		}

		deletes := []string{
			"DELETE FROM user_group_member WHERE user_group_id = ?",
			"DELETE FROM user_group WHERE id = ?",
			"DELETE FROM dashboard_acl WHERE user_group_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.Id)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func isUserGroupNameTaken(name string, existingId int64, sess *DBSession) (bool, error) {
	var userGroup m.UserGroup
	exists, err := sess.Where("name=?", name).Get(&userGroup)

	if err != nil {
		return false, nil
	}

	if exists && existingId != userGroup.Id {
		return true, nil
	}

	return false, nil
}

func SearchUserGroups(query *m.SearchUserGroupsQuery) error {
	query.Result = m.SearchUserGroupQueryResult{
		UserGroups: make([]*m.UserGroup, 0),
	}
	queryWithWildcards := "%" + query.Query + "%"

	sess := x.Table("user_group")
	sess.Where("org_id=?", query.OrgId)

	if query.Query != "" {
		sess.Where("name LIKE ?", queryWithWildcards)
	}
	if query.Name != "" {
		sess.Where("name=?", query.Name)
	}
	sess.Asc("name")

	offset := query.Limit * (query.Page - 1)
	sess.Limit(query.Limit, offset)
	sess.Cols("id", "name")
	if err := sess.Find(&query.Result.UserGroups); err != nil {
		return err
	}

	userGroup := m.UserGroup{}

	countSess := x.Table("user_group")
	if query.Query != "" {
		countSess.Where("name LIKE ?", queryWithWildcards)
	}
	if query.Name != "" {
		countSess.Where("name=?", query.Name)
	}
	count, err := countSess.Count(&userGroup)
	query.Result.TotalCount = count

	return err
}

func GetUserGroupById(query *m.GetUserGroupByIdQuery) error {
	var userGroup m.UserGroup
	exists, err := x.Id(query.Id).Get(&userGroup)
	if err != nil {
		return err
	}

	if !exists {
		return m.ErrUserGroupNotFound
	}

	query.Result = &userGroup
	return nil
}

func GetUserGroupsByUser(query *m.GetUserGroupsByUserQuery) error {
	query.Result = make([]*m.UserGroup, 0)

	sess := x.Table("user_group")
	sess.Join("INNER", "user_group_member", "user_group.id=user_group_member.user_group_id")
	sess.Where("user_group_member.user_id=?", query.UserId)

	err := sess.Find(&query.Result)
	if err != nil {
		return err
	}

	return nil
}

func AddUserGroupMember(cmd *m.AddUserGroupMemberCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if res, err := sess.Query("SELECT 1 from user_group_member WHERE user_group_id=? and user_id=?", cmd.UserGroupId, cmd.UserId); err != nil {
			return err
		} else if len(res) == 1 {
			return m.ErrUserGroupMemberAlreadyAdded
		}

		if res, err := sess.Query("SELECT 1 from user_group WHERE id=?", cmd.UserGroupId); err != nil {
			return err
		} else if len(res) != 1 {
			return m.ErrUserGroupNotFound
		}

		entity := m.UserGroupMember{
			OrgId:       cmd.OrgId,
			UserGroupId: cmd.UserGroupId,
			UserId:      cmd.UserId,
			Created:     time.Now(),
			Updated:     time.Now(),
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func RemoveUserGroupMember(cmd *m.RemoveUserGroupMemberCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM user_group_member WHERE user_group_id=? and user_id=?"
		_, err := sess.Exec(rawSql, cmd.UserGroupId, cmd.UserId)
		if err != nil {
			return err
		}

		return err
	})
}

func GetUserGroupMembers(query *m.GetUserGroupMembersQuery) error {
	query.Result = make([]*m.UserGroupMemberDTO, 0)
	sess := x.Table("user_group_member")
	sess.Join("INNER", "user", fmt.Sprintf("user_group_member.user_id=%s.id", x.Dialect().Quote("user")))
	sess.Where("user_group_member.user_group_id=?", query.UserGroupId)
	sess.Cols("user.org_id", "user_group_member.user_group_id", "user_group_member.user_id", "user.email", "user.login")
	sess.Asc("user.login", "user.email")

	err := sess.Find(&query.Result)
	return err
}

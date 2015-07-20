package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreateTempUser)
	bus.AddHandler("sql", GetTempUsersForOrg)
	bus.AddHandler("sql", UpdateTempUserStatus)
	bus.AddHandler("sql", GetTempUserByCode)
}

func UpdateTempUserStatus(cmd *m.UpdateTempUserStatusCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "UPDATE temp_user SET status=? WHERE code=?"
		_, err := sess.Exec(rawSql, string(cmd.Status), cmd.Code)
		return err
	})
}

func CreateTempUser(cmd *m.CreateTempUserCommand) error {
	return inTransaction2(func(sess *session) error {

		// create user
		user := &m.TempUser{
			Email:           cmd.Email,
			Name:            cmd.Name,
			OrgId:           cmd.OrgId,
			Code:            cmd.Code,
			Role:            cmd.Role,
			Status:          cmd.Status,
			RemoteAddr:      cmd.RemoteAddr,
			InvitedByUserId: cmd.InvitedByUserId,
			Created:         time.Now(),
			Updated:         time.Now(),
		}

		if _, err := sess.Insert(user); err != nil {
			return err
		}

		cmd.Result = user
		return nil
	})
}

func GetTempUsersForOrg(query *m.GetTempUsersForOrgQuery) error {
	var rawSql = `SELECT
	                tu.id             as id,
	                tu.email          as email,
									tu.name           as name,
									tu.role           as role,
									tu.code           as code,
									tu.email_sent     as email_sent,
									tu.email_sent_on  as email_sent_on,
									tu.created				as created,
									u.login						as invited_by
	                FROM ` + dialect.Quote("temp_user") + ` as tu
									LEFT OUTER JOIN ` + dialect.Quote("user") + ` as u on u.id = tu.invited_by_user_id
	                WHERE tu.org_id=? AND tu.status =? ORDER BY tu.created desc`

	query.Result = make([]*m.TempUserDTO, 0)
	sess := x.Sql(rawSql, query.OrgId, string(query.Status))
	err := sess.Find(&query.Result)
	return err
}

func GetTempUserByCode(query *m.GetTempUserByCodeQuery) error {
	var user m.TempUser
	has, err := x.Table("temp_user").Where("code=?", query.Code).Get(&user)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrTempUserNotFound
	}

	query.Result = &user
	return err
}

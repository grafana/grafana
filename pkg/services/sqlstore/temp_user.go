package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreateTempUser)
	bus.AddHandler("sql", GetTempUsersForOrg)
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
			IsInvite:        cmd.IsInvite,
			InvitedByUserId: cmd.InvitedByUserId,
			Created:         time.Now(),
			Updated:         time.Now(),
		}

		sess.UseBool("is_invite")

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
									tu.email_sent     as email_sent,
									tu.email_sent_on  as email_sent_on,
									tu.created				as created,
									u.login						as invited_by
	                FROM ` + dialect.Quote("temp_user") + ` as tu
									LEFT OUTER JOIN ` + dialect.Quote("user") + ` as u on u.id = tu.invited_by_user_id
	                WHERE tu.org_id=? ORDER BY tu.created desc`

	query.Result = make([]*m.TempUserDTO, 0)
	sess := x.Sql(rawSql, query.OrgId)
	err := sess.Find(&query.Result)
	return err
}

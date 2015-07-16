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
			Email:    cmd.Email,
			Name:     cmd.Name,
			OrgId:    cmd.OrgId,
			Code:     cmd.Code,
			IsInvite: cmd.IsInvite,
			Created:  time.Now(),
			Updated:  time.Now(),
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
	query.Result = make([]*m.TempUserDTO, 0)
	sess := x.Table("temp_user")
	sess.Where("org_id=?", query.OrgId)

	err := sess.Find(&query.Result)
	return err
}

package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", AddAccountUser)
	bus.AddHandler("sql", RemoveAccountUser)
	bus.AddHandler("sql", GetAccountUsers)
}

func AddAccountUser(cmd *m.AddAccountUserCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		entity := m.AccountUser{
			AccountId: cmd.AccountId,
			UserId:    cmd.UserId,
			Role:      cmd.Role,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func GetAccountUsers(query *m.GetAccountUsersQuery) error {
	query.Result = make([]*m.AccountUserDTO, 0)
	sess := x.Table("account_user")
	sess.Join("INNER", "user", "account_user.user_id=user.id")
	sess.Where("account_user.account_id=?", query.AccountId)
	sess.Cols("account_user.account_id", "account_user.user_id", "user.email", "user.login")

	err := sess.Find(&query.Result)
	return err
}

func RemoveAccountUser(cmd *m.RemoveAccountUserCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM account_user WHERE account_id=? and user_id=?"
		_, err := sess.Exec(rawSql, cmd.AccountId, cmd.UserId)
		return err
	})
}

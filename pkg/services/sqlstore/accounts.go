package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreateAccount)
	bus.AddHandler("sql", SetUsingAccount)
	bus.AddHandler("sql", UpdateAccount)
}

func CreateAccount(cmd *m.CreateAccountCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		account := m.Account{
			Name:    cmd.Name,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&account)
		cmd.Result = account
		return err
	})
}

func UpdateAccount(cmd *m.UpdateAccountCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		account := m.Account{
			Name:    cmd.Name,
			Updated: time.Now(),
		}

		_, err := sess.Id(cmd.AccountId).Update(&account)
		return err
	})
}

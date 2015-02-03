package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAccountById)
	bus.AddHandler("sql", CreateAccount)
	bus.AddHandler("sql", SetUsingAccount)
	bus.AddHandler("sql", UpdateAccount)
	bus.AddHandler("sql", GetAccountByName)
}

func GetAccountById(query *m.GetAccountByIdQuery) error {
	var account m.Account
	exists, err := x.Id(query.Id).Get(&account)
	if err != nil {
		return err
	}

	if !exists {
		return m.ErrAccountNotFound
	}

	query.Result = &account
	return nil
}

func GetAccountByName(query *m.GetAccountByNameQuery) error {
	var account m.Account
	exists, err := x.Where("name=?", query.Name).Get(&account)
	if err != nil {
		return err
	}

	if !exists {
		return m.ErrAccountNotFound
	}

	query.Result = &account
	return nil
}

func CreateAccount(cmd *m.CreateAccountCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		account := m.Account{
			Name:    cmd.Name,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if _, err := sess.Insert(&account); err != nil {
			return err
		}

		// create inital admin account user
		user := m.AccountUser{
			AccountId: account.Id,
			UserId:    cmd.UserId,
			Role:      m.ROLE_ADMIN,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		_, err := sess.Insert(&user)
		cmd.Result = account

		// silently ignore failures to publish events.
		_ = bus.Publish(&m.Notification{
			EventType: "account.create",
			Timestamp: account.Created,
			Priority:  m.PRIO_INFO,
			Payload:   account,
		})
		 
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
		if err == nil {
			// silently ignore failures to publish events.
			account.Id = cmd.AccountId
			_ = bus.Publish(&m.Notification{
				EventType: "account.update",
				Timestamp: account.Updated,
				Priority:  m.PRIO_INFO,
				Payload:   account,
			})
		}
		return err
	})
}

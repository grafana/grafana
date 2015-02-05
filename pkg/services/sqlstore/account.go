package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
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
	return inTransaction2(func(sess *session) error {

		account := m.Account{
			Name:    cmd.Name,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if _, err := sess.Insert(&account); err != nil {
			return err
		}

		user := m.AccountUser{
			AccountId: account.Id,
			UserId:    cmd.UserId,
			Role:      m.ROLE_ADMIN,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		_, err := sess.Insert(&user)
		cmd.Result = account

		sess.publishAfterCommit(&events.AccountCreated{
			Timestamp: account.Created,
			Id:        account.Id,
			Name:      account.Name,
		})

		return err
	})
}

func UpdateAccount(cmd *m.UpdateAccountCommand) error {
	return inTransaction2(func(sess *session) error {

		account := m.Account{
			Name:    cmd.Name,
			Updated: time.Now(),
		}

		if _, err := sess.Id(cmd.AccountId).Update(&account); err != nil {
			return err
		}

		sess.publishAfterCommit(&events.AccountUpdated{
			Timestamp: account.Updated,
			Id:        account.Id,
			Name:      account.Name,
		})

		return nil
	})
}

package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAccountById)
	bus.AddHandler("sql", CreateAccount)
	bus.AddHandler("sql", SetUsingAccount)
	bus.AddHandler("sql", UpdateAccount)
	bus.AddHandler("sql", GetAccountByName)
	bus.AddHandler("sql", GetAccountsQuery)
	bus.AddHandler("sql", DeleteAccount)
}

func GetAccountsQuery(query *m.GetAccountsQuery) error {
	return x.Find(&query.Result)
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

func DeleteAccount(cmd *m.DeleteAccountCommand) error {
	return inTransaction2(func(sess *session) error {

		deletes := []string{
			"DELETE FROM star WHERE EXISTS (SELECT 1 FROM dashboard WHERE account_id = ?)",
			"DELETE FROM dashboard_tag WHERE EXISTS (SELECT 1 FROM dashboard WHERE account_id = ?)",
			"DELETE FROM dashboard WHERE account_id = ?",
			"DELETE FROM api_key WHERE account_id = ?",
			"DELETE FROM data_source WHERE account_id = ?",
			"DELETE FROM account_user WHERE account_id = ?",
			"DELETE FROM user WHERE account_id = ?",
			"DELETE FROM account WHERE id = ?",
		}

		for _, sql := range deletes {
			log.Trace(sql)
			_, err := sess.Exec(sql, cmd.Id)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

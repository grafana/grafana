package sqlstore

import (
	"github.com/torkelo/grafana-pro/pkg/models"
)

func CreateAccount(account *models.Account) error {
	var err error

	sess := x.NewSession()
	defer sess.Close()

	if err = sess.Begin(); err != nil {
		return err
	}

	if _, err = sess.Insert(account); err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	return nil
}

func GetAccount(id int64) (*models.Account, error) {
	var err error

	account := &models.Account{Id: id}
	has, err := x.Get(account)

	if err != nil {
		return nil, err
	} else if has == false {
		return nil, models.ErrAccountNotFound
	}

	return account, nil
}

func GetAccountByLogin(emailOrLogin string) (*models.Account, error) {
	var err error

	account := &models.Account{Login: emailOrLogin}
	has, err := x.Get(account)

	if err != nil {
		return nil, err
	} else if has == false {
		return nil, models.ErrAccountNotFound
	}

	return account, nil
}

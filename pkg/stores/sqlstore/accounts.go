package sqlstore

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAccountInfo)
}

func GetAccountInfo(query *m.GetAccountInfoQuery) error {
	var account m.Account
	has, err := x.Id(query.Id).Get(&account)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrAccountNotFound
	}

	query.Result = m.AccountDTO{
		Name:          account.Name,
		Email:         account.Email,
		Collaborators: make([]*m.CollaboratorDTO, 0),
	}

	sess := x.Table("collaborator")
	sess.Join("INNER", "account", "account.id=collaborator.account_Id")
	sess.Where("collaborator.for_account_id=?", query.Id)
	err = sess.Find(&query.Result.Collaborators)

	return err
}

func SaveAccount(account *m.Account) error {
	var err error

	sess := x.NewSession()
	defer sess.Close()

	if err = sess.Begin(); err != nil {
		return err
	}

	if account.Id == 0 {
		_, err = sess.Insert(account)
	} else {
		_, err = sess.Id(account.Id).Update(account)
	}

	if err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	return nil
}

func GetAccount(id int64) (*m.Account, error) {
	var err error

	var account m.Account
	has, err := x.Id(id).Get(&account)

	if err != nil {
		return nil, err
	} else if has == false {
		return nil, m.ErrAccountNotFound
	}

	if account.UsingAccountId == 0 {
		account.UsingAccountId = account.Id
	}

	return &account, nil
}

func GetAccountByLogin(emailOrLogin string) (*m.Account, error) {
	var err error

	account := &m.Account{Login: emailOrLogin}
	has, err := x.Get(account)

	if err != nil {
		return nil, err
	} else if has == false {
		return nil, m.ErrAccountNotFound
	}

	return account, nil
}

func GetCollaboratorsForAccount(accountId int64) ([]*m.CollaboratorInfo, error) {
	collaborators := make([]*m.CollaboratorInfo, 0)

	sess := x.Table("collaborator")
	sess.Join("INNER", "account", "account.id=collaborator.account_Id")
	sess.Where("collaborator.for_account_id=?", accountId)
	err := sess.Find(&collaborators)

	return collaborators, err
}

func AddCollaborator(collaborator *m.Collaborator) error {
	var err error

	sess := x.NewSession()
	defer sess.Close()

	if err = sess.Begin(); err != nil {
		return err
	}

	if _, err = sess.Insert(collaborator); err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	return nil
}

func GetOtherAccountsFor(accountId int64) ([]*m.OtherAccount, error) {
	collaborators := make([]*m.OtherAccount, 0)
	sess := x.Table("collaborator")
	sess.Join("INNER", "account", "collaborator.for_account_id=account.id")
	sess.Where("account_id=?", accountId)
	sess.Cols("collaborator.id", "collaborator.role", "account.email")
	err := sess.Find(&collaborators)
	return collaborators, err
}

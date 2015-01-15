package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAccountInfo)
	bus.AddHandler("sql", GetOtherAccounts)
	bus.AddHandler("sql", CreateAccount)
	bus.AddHandler("sql", SetUsingAccount)
	bus.AddHandler("sql", GetAccountById)
	bus.AddHandler("sql", GetAccountByLogin)
	bus.AddHandler("sql", GetAccountByToken)
	bus.AddHandler("sql", AddCollaborator)
	bus.AddHandler("sql", RemoveCollaborator)
	bus.AddHandler("sql", SearchAccounts)
}

func CreateAccount(cmd *m.CreateAccountCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		account := m.Account{
			Email:    cmd.Email,
			Login:    cmd.Login,
			Password: cmd.Password,
			Salt:     cmd.Salt,
			Created:  time.Now(),
			Updated:  time.Now(),
		}

		_, err := sess.Insert(&account)
		cmd.Result = account
		return err
	})
}

func SetUsingAccount(cmd *m.SetUsingAccountCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		account := m.Account{}
		sess.Id(cmd.AccountId).Get(&account)

		account.UsingAccountId = cmd.UsingAccountId
		_, err := sess.Id(account.Id).Update(&account)
		return err
	})
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
	sess.Join("INNER", "account", "account.id=collaborator.collaborator_id")
	sess.Where("collaborator.account_id=?", query.Id)
	err = sess.Find(&query.Result.Collaborators)

	return err
}

func AddCollaborator(cmd *m.AddCollaboratorCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		entity := m.Collaborator{
			AccountId:      cmd.AccountId,
			CollaboratorId: cmd.CollaboratorId,
			Role:           cmd.Role,
			Created:        time.Now(),
			Updated:        time.Now(),
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func GetAccountById(query *m.GetAccountByIdQuery) error {
	var err error

	var account m.Account
	has, err := x.Id(query.Id).Get(&account)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrAccountNotFound
	}

	if account.UsingAccountId == 0 {
		account.UsingAccountId = account.Id
	}

	query.Result = &account

	return nil
}

func GetAccountByToken(query *m.GetAccountByTokenQuery) error {
	var err error

	var account m.Account
	sess := x.Join("INNER", "token", "token.account_id = account.id")
	sess.Omit("token.id", "token.account_id", "token.name", "token.token",
		"token.role", "token.updated", "token.created")
	has, err := sess.Where("token.token=?", query.Token).Get(&account)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrAccountNotFound
	}

	if account.UsingAccountId == 0 {
		account.UsingAccountId = account.Id
	}

	query.Result = &account

	return nil
}

func GetAccountByLogin(query *m.GetAccountByLoginQuery) error {
	var err error

	account := m.Account{Login: query.Login}
	has, err := x.Get(&account)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrAccountNotFound
	}

	if account.UsingAccountId == 0 {
		account.UsingAccountId = account.Id
	}

	query.Result = &account

	return nil
}

func RemoveCollaborator(cmd *m.RemoveCollaboratorCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM collaborator WHERE collaborator_id=? and account_id=?"
		_, err := sess.Exec(rawSql, cmd.CollaboratorId, cmd.AccountId)
		return err
	})
}

func GetOtherAccounts(query *m.GetOtherAccountsQuery) error {
	query.Result = make([]*m.OtherAccountDTO, 0)
	sess := x.Table("collaborator")
	sess.Join("INNER", "account", "collaborator.account_id=account.id")
	sess.Where("collaborator_id=?", query.AccountId)
	sess.Cols("collaborator.account_id", "collaborator.role", "account.email")
	err := sess.Find(&query.Result)
	return err
}

func SearchAccounts(query *m.SearchAccountsQuery) error {
	query.Result = make([]*m.AccountSearchHitDTO, 0)
	sess := x.Table("account")
	sess.Where("email LIKE ?", query.Query+"%")
	sess.Limit(query.Limit, query.Limit*query.Page)
	sess.Cols("id", "email", "name")
	err := sess.Find(&query.Result)
	return err

}

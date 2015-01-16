package sqlstore

import (
	"strings"
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
	bus.AddHandler("sql", SearchAccounts)
	bus.AddHandler("sql", UpdateAccount)
	bus.AddHandler("sql", GetSignedInUser)
}

func CreateAccount(cmd *m.CreateAccountCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		account := m.Account{
			Email:    cmd.Email,
			Name:     cmd.Name,
			Login:    cmd.Login,
			Password: cmd.Password,
			Salt:     cmd.Salt,
			IsAdmin:  cmd.IsAdmin,
			Created:  time.Now(),
			Updated:  time.Now(),
		}

		sess.UseBool("is_admin")

		_, err := sess.Insert(&account)
		cmd.Result = account
		return err
	})
}

func UpdateAccount(cmd *m.UpdateAccountCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		account := m.Account{
			Email:   cmd.Email,
			Login:   cmd.Login,
			Name:    cmd.Name,
			Updated: time.Now(),
		}

		_, err := sess.Id(cmd.AccountId).Update(&account)
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
		Name:  account.Name,
		Email: account.Email,
		Login: account.Login,
	}

	return err
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
	if query.LoginOrEmail == "" {
		return m.ErrAccountNotFound
	}

	account := new(m.Account)
	if strings.Contains(query.LoginOrEmail, "@") {
		account = &m.Account{Email: query.LoginOrEmail}
	} else {
		account = &m.Account{Login: strings.ToLower(query.LoginOrEmail)}
	}

	has, err := x.Get(account)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrAccountNotFound
	}

	if account.UsingAccountId == 0 {
		account.UsingAccountId = account.Id
	}

	query.Result = account

	return nil
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
	sess.Cols("id", "email", "name", "login", "is_admin")
	err := sess.Find(&query.Result)
	return err
}

func GetSignedInUser(query *m.GetSignedInUserQuery) error {
	var rawSql = `SELECT
	                userAccount.id       as account_id,
	                userAccount.is_admin as is_grafana_admin,
	                userAccount.email    as user_email,
	                userAccount.name     as user_name,
	                userAccount.login    as user_login,
	                usingAccount.id      as using_account_id,
	                usingAccount.name    as using_account_name,
	                collaborator.role    as user_role
	                FROM account as userAccount
	                LEFT OUTER JOIN account as usingAccount on usingAccount.id = userAccount.using_account_id
	                LEFT OUTER JOIN collaborator on collaborator.account_id = usingAccount.id AND collaborator.collaborator_id = userAccount.id
	                WHERE userAccount.id=?`

	var user m.SignInUser
	sess := x.Table("account")
	has, err := sess.Sql(rawSql, query.AccountId).Get(&user)
	if err != nil {
		return err
	} else if !has {
		return m.ErrAccountNotFound
	}

	if user.UsingAccountId == 0 || user.UsingAccountId == user.AccountId {
		user.UsingAccountId = query.AccountId
		user.UsingAccountName = user.UserName
		user.UserRole = m.ROLE_OWNER
	}

	query.Result = &user
	return err
}

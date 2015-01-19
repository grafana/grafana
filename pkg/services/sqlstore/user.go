package sqlstore

import (
	"strings"
	"time"

	"github.com/go-xorm/xorm"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreateUser)
	bus.AddHandler("sql", GetUserByLogin)
	bus.AddHandler("sql", SetUsingAccount)
	bus.AddHandler("sql", GetUserInfo)
	bus.AddHandler("sql", GetSignedInUser)
	bus.AddHandler("sql", SearchUsers)
	bus.AddHandler("sql", GetUserAccounts)
}

func CreateUser(cmd *m.CreateUserCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		// create account
		account := m.Account{
			Name:    cmd.Email,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if _, err := sess.Insert(&account); err != nil {
			return err
		}

		// create user
		user := m.User{
			Email:     cmd.Email,
			Password:  cmd.Password,
			Name:      cmd.Name,
			Login:     cmd.Login,
			Company:   cmd.Company,
			Salt:      cmd.Salt,
			IsAdmin:   cmd.IsAdmin,
			AccountId: account.Id,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		sess.UseBool("is_admin")
		if _, err := sess.Insert(&user); err != nil {
			return err
		}

		// create account user link
		_, err := sess.Insert(&m.AccountUser{
			AccountId: account.Id,
			UserId:    user.Id,
			Role:      m.ROLE_ADMIN,
			Created:   time.Now(),
			Updated:   time.Now(),
		})

		cmd.Result = user
		return err
	})
}

func GetUserByLogin(query *m.GetUserByLoginQuery) error {
	if query.LoginOrEmail == "" {
		return m.ErrAccountNotFound
	}

	user := new(m.User)
	if strings.Contains(query.LoginOrEmail, "@") {
		user = &m.User{Email: query.LoginOrEmail}
	} else {
		user = &m.User{Login: strings.ToLower(query.LoginOrEmail)}
	}

	has, err := x.Get(user)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func SetUsingAccount(cmd *m.SetUsingAccountCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		user := m.User{}
		sess.Id(cmd.UserId).Get(&user)

		user.AccountId = cmd.AccountId
		_, err := sess.Id(user.Id).Update(&user)
		return err
	})
}

func GetUserInfo(query *m.GetUserInfoQuery) error {
	var user m.User
	has, err := x.Id(query.UserId).Get(&user)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrUserNotFound
	}

	query.Result = m.UserDTO{
		Name:  user.Name,
		Email: user.Email,
		Login: user.Login,
	}

	return err
}

func GetUserAccounts(query *m.GetUserAccountsQuery) error {
	query.Result = make([]*m.UserAccountDTO, 0)
	sess := x.Table("account_user")
	sess.Join("INNER", "account", "account_user.account_id=account.id")
	sess.Where("account_user.user_id=?", query.UserId)
	sess.Cols("account.name", "account_user.role", "account_user.account_id")
	err := sess.Find(&query.Result)
	return err
}

func GetSignedInUser(query *m.GetSignedInUserQuery) error {
	var rawSql = `SELECT
	                user.id           as user_id,
	                user.is_admin     as is_grafana_admin,
	                user.email        as email,
	                user.login        as login,
									user.name         as name,
	                account.name      as account_name,
	                account_user.role as account_role,
	                account.id        as account_id
	                FROM user
									LEFT OUTER JOIN account_user on account_user.account_id = user.account_id and account_user.user_id = user.id
	                LEFT OUTER JOIN account on account.id = user.account_id
	                WHERE user.id=?`

	var user m.SignedInUser
	sess := x.Table("user")
	has, err := sess.Sql(rawSql, query.UserId).Get(&user)
	if err != nil {
		return err
	} else if !has {
		return m.ErrUserNotFound
	}

	query.Result = &user
	return err
}

func SearchUsers(query *m.SearchUsersQuery) error {
	query.Result = make([]*m.UserSearchHitDTO, 0)
	sess := x.Table("user")
	sess.Where("email LIKE ?", query.Query+"%")
	sess.Limit(query.Limit, query.Limit*query.Page)
	sess.Cols("id", "email", "name", "login", "is_admin")
	err := sess.Find(&query.Result)
	return err
}

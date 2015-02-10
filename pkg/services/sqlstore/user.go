package sqlstore

import (
	"strings"
	"time"

	"github.com/go-xorm/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", CreateUser)
	bus.AddHandler("sql", GetUserById)
	bus.AddHandler("sql", UpdateUser)
	bus.AddHandler("sql", GetUserByLogin)
	bus.AddHandler("sql", SetUsingAccount)
	bus.AddHandler("sql", GetUserInfo)
	bus.AddHandler("sql", GetSignedInUser)
	bus.AddHandler("sql", SearchUsers)
	bus.AddHandler("sql", GetUserAccounts)
}

func getAccountIdForNewUser(userEmail string, sess *session) (int64, error) {
	var account m.Account

	if setting.SingleAccountMode {
		has, err := sess.Where("name=?", setting.DefaultAccountName).Get(&account)
		if err != nil {
			return 0, err
		}
		if has {
			return account.Id, nil
		} else {
			account.Name = setting.DefaultAccountName
		}
	} else {
		account.Name = userEmail
	}

	account.Created = time.Now()
	account.Updated = time.Now()

	if _, err := sess.Insert(&account); err != nil {
		return 0, err
	}

	return account.Id, nil
}

func CreateUser(cmd *m.CreateUserCommand) error {
	return inTransaction2(func(sess *session) error {
		accountId, err := getAccountIdForNewUser(cmd.Email, sess)
		if err != nil {
			return err
		}

		// create user
		user := m.User{
			Email:     cmd.Email,
			Name:      cmd.Name,
			Login:     cmd.Login,
			Company:   cmd.Company,
			IsAdmin:   cmd.IsAdmin,
			AccountId: accountId,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		if len(cmd.Password) > 0 {
			user.Salt = util.GetRandomString(10)
			user.Rands = util.GetRandomString(10)
			user.Password = util.EncodePassword(cmd.Password, user.Salt)
		}

		sess.UseBool("is_admin")

		if _, err := sess.Insert(&user); err != nil {
			return err
		}

		// create account user link
		accountUser := m.AccountUser{
			AccountId: accountId,
			UserId:    user.Id,
			Role:      m.ROLE_ADMIN,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		if setting.SingleAccountMode && !user.IsAdmin {
			accountUser.Role = m.RoleType(setting.DefaultAccountRole)
		}

		if _, err = sess.Insert(&accountUser); err != nil {
			return err
		}

		sess.publishAfterCommit(&events.UserCreated{
			Timestamp: user.Created,
			Id:        user.Id,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
		})

		cmd.Result = user
		return nil
	})
}

func GetUserById(query *m.GetUserByIdQuery) error {
	user := new(m.User)
	has, err := x.Id(query.Id).Get(user)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func GetUserByLogin(query *m.GetUserByLoginQuery) error {
	if query.LoginOrEmail == "" {
		return m.ErrUserNotFound
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

func UpdateUser(cmd *m.UpdateUserCommand) error {
	return inTransaction2(func(sess *session) error {

		user := m.User{
			Name:    cmd.Name,
			Email:   cmd.Email,
			Login:   cmd.Login,
			Updated: time.Now(),
		}

		if _, err := sess.Id(cmd.UserId).Update(&user); err != nil {
			return err
		}

		sess.publishAfterCommit(&events.UserUpdated{
			Timestamp: user.Created,
			Id:        user.Id,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
		})

		return nil
	})
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
	                u.id           as user_id,
	                u.is_admin     as is_grafana_admin,
	                u.email        as email,
	                u.login        as login,
									u.name         as name,
	                account.name      as account_name,
	                account_user.role as account_role,
	                account.id        as account_id
	                FROM ` + dialect.Quote("user") + ` as u
									LEFT OUTER JOIN account_user on account_user.account_id = u.account_id and account_user.user_id = u.id
	                LEFT OUTER JOIN account on account.id = u.account_id
	                WHERE u.id=?`

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

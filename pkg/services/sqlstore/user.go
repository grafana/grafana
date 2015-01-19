package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreateUser)
}

func CreateUser(cmd *m.CreateUserCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		// create account
		account := m.Account2{
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

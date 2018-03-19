package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetUserByAuthInfo)
	bus.AddHandler("sql", GetAuthInfo)
	bus.AddHandler("sql", SetAuthInfo)
	bus.AddHandler("sql", DeleteAuthInfo)
}

func GetUserByAuthInfo(query *m.GetUserByAuthInfoQuery) error {
	user := new(m.User)
	has := false
	var err error

	// Try to find the user by auth module and id first
	if query.AuthModule != "" && query.AuthId != "" {
		authQuery := &m.GetAuthInfoQuery{
			AuthModule: query.AuthModule,
			AuthId:     query.AuthId,
		}

		err = GetAuthInfo(authQuery)
		// if user id was specified and doesn't match the user_auth entry, remove it
		if err == nil && query.UserId != 0 && query.UserId != authQuery.UserAuth.UserId {
			DeleteAuthInfo(&m.DeleteAuthInfoCommand{
				UserAuth: authQuery.UserAuth,
			})
		} else if err == nil {
			has, err = x.Id(authQuery.UserAuth.UserId).Get(user)
			if err != nil {
				return err
			}

			if has {
				query.UserAuth = authQuery.UserAuth
			} else {
				// if the user has been deleted then remove the entry
				DeleteAuthInfo(&m.DeleteAuthInfoCommand{
					UserAuth: authQuery.UserAuth,
				})
			}
		} else if err != m.ErrUserNotFound {
			return err
		}
	}

	// If not found, try to find the user by id
	if !has && query.UserId != 0 {
		has, err = x.Id(query.UserId).Get(user)
		if err != nil {
			return err
		}
	}

	// If not found, try to find the user by email address
	if !has && query.Email != "" {
		user = &m.User{Email: query.Email}
		has, err = x.Get(user)
		if err != nil {
			return err
		}
	}

	// If not found, try to find the user by login
	if !has && query.Login != "" {
		user = &m.User{Login: query.Login}
		has, err = x.Get(user)
		if err != nil {
			return err
		}
	}

	// No user found
	if !has {
		return m.ErrUserNotFound
	}

	query.User = user
	return nil
}

func GetAuthInfo(query *m.GetAuthInfoQuery) error {
	userAuth := &m.UserAuth{
		AuthModule: query.AuthModule,
		AuthId:     query.AuthId,
	}
	has, err := x.Get(userAuth)
	if err != nil {
		return err
	}
	if !has {
		return m.ErrUserNotFound
	}

	query.UserAuth = userAuth
	return nil
}

func SetAuthInfo(cmd *m.SetAuthInfoCommand) error {
	return inTransaction(func(sess *DBSession) error {
		authUser := m.UserAuth{
			UserId:     cmd.UserId,
			AuthModule: cmd.AuthModule,
			AuthId:     cmd.AuthId,
			Created:    time.Now(),
		}

		_, err := sess.Insert(&authUser)
		if err != nil {
			return err
		}

		return nil
	})
}

func DeleteAuthInfo(cmd *m.DeleteAuthInfoCommand) error {
	return inTransaction(func(sess *DBSession) error {
		_, err := sess.Delete(cmd.UserAuth)
		if err != nil {
			return err
		}

		return nil
	})
}

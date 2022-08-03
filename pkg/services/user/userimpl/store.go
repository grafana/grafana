package userimpl

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
)

type store interface {
	Insert(context.Context, *user.User) (int64, error)
	Get(context.Context, *user.User) (*user.User, error)
	GetByID(context.Context, int64) (*user.User, error)
	GetNotServiceAccount(context.Context, int64) (*user.User, error)
	Delete(context.Context, int64) error
	CaseInsensitiveLoginConflict(context.Context, string, string) error
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
}

func (ss *sqlStore) Insert(ctx context.Context, cmd *user.User) (int64, error) {
	var userID int64
	var err error
	err = ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		sess.UseBool("is_admin")

		if userID, err = sess.Insert(cmd); err != nil {
			return err
		}
		sess.PublishAfterCommit(&events.UserCreated{
			Timestamp: cmd.Created,
			Id:        cmd.ID,
			Name:      cmd.Name,
			Login:     cmd.Login,
			Email:     cmd.Email,
		})
		return nil
	})
	if err != nil {
		return 0, err
	}
	return userID, nil
}

func (ss *sqlStore) Get(ctx context.Context, usr *user.User) (*user.User, error) {
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		exists, err := sess.Where("email=? OR login=?", usr.Email, usr.Login).Get(usr)
		if !exists {
			return user.ErrUserNotFound
		}
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return usr, nil
}

func (ss *sqlStore) Delete(ctx context.Context, userID int64) error {
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var rawSQL = "DELETE FROM " + ss.dialect.Quote("user") + " WHERE id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
	if err != nil {
		return err
	}
	return nil
}

func (ss *sqlStore) GetNotServiceAccount(ctx context.Context, userID int64) (*user.User, error) {
	usr := user.User{ID: userID}
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Where(ss.notServiceAccountFilter()).Get(&usr)
		if err != nil {
			return err
		}
		if !has {
			return user.ErrUserNotFound
		}
		return nil
	})
	return &usr, err
}

func (ss *sqlStore) GetByID(ctx context.Context, userID int64) (*user.User, error) {
	var usr user.User

	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.ID(&userID).
			Where(ss.notServiceAccountFilter()).
			Get(&usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})
	return &usr, err
}

func (ss *sqlStore) notServiceAccountFilter() string {
	return fmt.Sprintf("%s.is_service_account = %s",
		ss.dialect.Quote("user"),
		ss.dialect.BooleanStr(false))
}

func (ss *sqlStore) CaseInsensitiveLoginConflict(ctx context.Context, login, email string) error {
	users := make([]user.User, 0)
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if err := sess.Where("LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)",
			email, login).Find(&users); err != nil {
			return err
		}

		if len(users) > 1 {
			return &user.ErrCaseInsensitiveLoginConflict{Users: users}
		}
		return nil
	})
	return err
}

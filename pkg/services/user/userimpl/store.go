package userimpl

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	Insert(context.Context, *user.User) (int64, error)
	Get(context.Context, *user.User) (*user.User, error)
	GetByID(context.Context, int64) (*user.User, error)
	GetNotServiceAccount(context.Context, int64) (*user.User, error)
	Delete(context.Context, int64) error
	CaseInsensitiveLoginConflict(context.Context, string, string) error
	GetByLogin(context.Context, *user.GetUserByLoginQuery) (*user.User, error)
	GetByEmail(context.Context, *user.GetUserByEmailQuery) (*user.User, error)
	Update(context.Context, *user.UpdateUserCommand) error
	ChangePassword(context.Context, *user.ChangeUserPasswordCommand) error
	UpdateLastSeenAt(context.Context, *user.UpdateUserLastSeenAtCommand) error
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
	logger  log.Logger
	cfg     *setting.Cfg
}

func ProvideStore(db db.DB, cfg *setting.Cfg) sqlStore {
	return sqlStore{
		db:      db,
		dialect: db.GetDialect(),
		cfg:     cfg,
		logger:  log.New("user.store"),
	}
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

func (ss *sqlStore) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	usr := &user.User{}
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if query.LoginOrEmail == "" {
			return user.ErrUserNotFound
		}

		// Try and find the user by login first.
		// It's not sufficient to assume that a LoginOrEmail with an "@" is an email.
		where := "login=?"
		if ss.cfg.CaseInsensitiveLogin {
			where = "LOWER(login)=LOWER(?)"
		}

		has, err := sess.Where(ss.notServiceAccountFilter()).Where(where, query.LoginOrEmail).Get(usr)
		if err != nil {
			return err
		}

		if !has && strings.Contains(query.LoginOrEmail, "@") {
			// If the user wasn't found, and it contains an "@" fallback to finding the
			// user by email.

			where = "email=?"
			if ss.cfg.CaseInsensitiveLogin {
				where = "LOWER(email)=LOWER(?)"
			}
			usr = &user.User{}
			has, err = sess.Where(ss.notServiceAccountFilter()).Where(where, query.LoginOrEmail).Get(usr)
		}

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if ss.cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, usr.Login, usr.Email); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return usr, nil
}

func (ss *sqlStore) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	usr := &user.User{}
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if query.Email == "" {
			return user.ErrUserNotFound
		}

		where := "email=?"
		if ss.cfg.CaseInsensitiveLogin {
			where = "LOWER(email)=LOWER(?)"
		}

		has, err := sess.Where(ss.notServiceAccountFilter()).Where(where, query.Email).Get(usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if ss.cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, usr.Login, usr.Email); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return usr, nil
}

func (ss *sqlStore) userCaseInsensitiveLoginConflict(ctx context.Context, sess *sqlstore.DBSession, login, email string) error {
	users := make([]user.User, 0)

	if err := sess.Where("LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)",
		email, login).Find(&users); err != nil {
		return err
	}

	if len(users) > 1 {
		return &user.ErrCaseInsensitiveLoginConflict{Users: users}
	}

	return nil
}

func (ss *sqlStore) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	if ss.cfg.CaseInsensitiveLogin {
		cmd.Login = strings.ToLower(cmd.Login)
		cmd.Email = strings.ToLower(cmd.Email)
	}

	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		user := user.User{
			Name:    cmd.Name,
			Email:   cmd.Email,
			Login:   cmd.Login,
			Theme:   cmd.Theme,
			Updated: time.Now(),
		}

		if _, err := sess.ID(cmd.UserID).Where(ss.notServiceAccountFilter()).Update(&user); err != nil {
			return err
		}

		if ss.cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, user.Login, user.Email); err != nil {
				return err
			}
		}

		sess.PublishAfterCommit(&events.UserUpdated{
			Timestamp: user.Created,
			Id:        user.ID,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
		})

		return nil
	})
}

func (ss *sqlStore) ChangePassword(ctx context.Context, cmd *user.ChangeUserPasswordCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		user := user.User{
			Password: cmd.NewPassword,
			Updated:  time.Now(),
		}

		_, err := sess.ID(cmd.UserID).Where(ss.notServiceAccountFilter()).Update(&user)
		return err
	})
}

func (ss *sqlStore) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		user := user.User{
			ID:         cmd.UserID,
			LastSeenAt: time.Now(),
		}

		_, err := sess.ID(cmd.UserID).Update(&user)
		return err
	})
}

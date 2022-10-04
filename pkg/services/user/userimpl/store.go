package userimpl

import (
	"context"
	"fmt"
	"strconv"
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
	GetSignedInUser(context.Context, *user.GetSignedInUserQuery) (*user.SignedInUser, error)
	UpdateUser(context.Context, *user.User) error
	GetProfile(context.Context, *user.GetUserProfileQuery) (*user.UserProfileDTO, error)
	SetHelpFlag(context.Context, *user.SetUserHelpFlagCommand) error
	UpdatePermissions(context.Context, int64, bool) error
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

func (ss *sqlStore) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	var signedInUser user.SignedInUser
	err := ss.db.WithDbSession(ctx, func(dbSess *sqlstore.DBSession) error {
		orgId := "u.org_id"
		if query.OrgID > 0 {
			orgId = strconv.FormatInt(query.OrgID, 10)
		}

		var rawSQL = `SELECT
		u.id                  as user_id,
		u.is_admin            as is_grafana_admin,
		u.email               as email,
		u.login               as login,
		u.name                as name,
		u.is_disabled         as is_disabled,
		u.help_flags1         as help_flags1,
		u.last_seen_at        as last_seen_at,
		(SELECT COUNT(*) FROM org_user where org_user.user_id = u.id) as org_count,
		user_auth.auth_module as external_auth_module,
		user_auth.auth_id     as external_auth_id,
		org.name              as org_name,
		org_user.role         as org_role,
		org.id                as org_id
		FROM ` + ss.dialect.Quote("user") + ` as u
		LEFT OUTER JOIN user_auth on user_auth.user_id = u.id
		LEFT OUTER JOIN org_user on org_user.org_id = ` + orgId + ` and org_user.user_id = u.id
		LEFT OUTER JOIN org on org.id = org_user.org_id `

		sess := dbSess.Table("user")
		sess = sess.Context(ctx)
		switch {
		case query.UserID > 0:
			sess.SQL(rawSQL+"WHERE u.id=?", query.UserID)
		case query.Login != "":
			if ss.cfg.CaseInsensitiveLogin {
				sess.SQL(rawSQL+"WHERE LOWER(u.login)=LOWER(?)", query.Login)
			} else {
				sess.SQL(rawSQL+"WHERE u.login=?", query.Login)
			}
		case query.Email != "":
			if ss.cfg.CaseInsensitiveLogin {
				sess.SQL(rawSQL+"WHERE LOWER(u.email)=LOWER(?)", query.Email)
			} else {
				sess.SQL(rawSQL+"WHERE u.email=?", query.Email)
			}
		}
		has, err := sess.Get(&signedInUser)
		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if signedInUser.OrgRole == "" {
			signedInUser.OrgID = -1
			signedInUser.OrgName = "Org missing"
		}

		if signedInUser.ExternalAuthModule != "oauth_grafana_com" {
			signedInUser.ExternalAuthID = ""
		}
		return nil
	})
	return &signedInUser, err
}

func (ss *sqlStore) UpdateUser(ctx context.Context, user *user.User) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.ID(user.ID).Update(user)
		return err
	})
}

func (ss *sqlStore) GetProfile(ctx context.Context, query *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	var usr user.User
	var userProfile user.UserProfileDTO
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.ID(query.UserID).Where(ss.notServiceAccountFilter()).Get(&usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		userProfile = user.UserProfileDTO{
			ID:             usr.ID,
			Name:           usr.Name,
			Email:          usr.Email,
			Login:          usr.Login,
			Theme:          usr.Theme,
			IsGrafanaAdmin: usr.IsAdmin,
			IsDisabled:     usr.IsDisabled,
			OrgID:          usr.OrgID,
			UpdatedAt:      usr.Updated,
			CreatedAt:      usr.Created,
		}

		return err
	})
	return &userProfile, err
}

func (ss *sqlStore) SetHelpFlag(ctx context.Context, cmd *user.SetUserHelpFlagCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		user := user.User{
			ID:         cmd.UserID,
			HelpFlags1: cmd.HelpFlags1,
			Updated:    sqlstore.TimeNow(),
		}

		_, err := sess.ID(cmd.UserID).Cols("help_flags1").Update(&user)
		return err
	})
}

// UpdatePermissions sets the user Server Admin flag
func (ss *sqlStore) UpdatePermissions(ctx context.Context, userID int64, isAdmin bool) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var user user.User
		if _, err := sess.ID(userID).Where(ss.notServiceAccountFilter()).Get(&user); err != nil {
			return err
		}

		user.IsAdmin = isAdmin
		sess.UseBool("is_admin")
		_, err := sess.ID(user.ID).Update(&user)
		if err != nil {
			return err
		}
		// validate that after update there is at least one server admin
		if err := validateOneAdminLeft(ctx, sess); err != nil {
			return err
		}
		return nil
	})
}

// validateOneAdminLeft validate that there is an admin user left
func validateOneAdminLeft(ctx context.Context, sess *sqlstore.DBSession) error {
	count, err := sess.Where("is_admin=?", true).Count(&user.User{})
	if err != nil {
		return err
	}

	if count == 0 {
		return user.ErrLastGrafanaAdmin
	}

	return nil
}

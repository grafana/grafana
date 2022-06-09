package userimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/user"
)

type store interface {
	Create(context.Context, *user.CreateUserCommand) error
	Get(context.Context, *user.CreateUserCommand) (*user.User, error)
	// ????
	Insert(context.Context, *models.OrgUser) error
}

type sqlStore struct {
	db   db.DB
	sess *sqlstore.DBSession
}

func (ss *sqlStore) Create(ctx context.Context, cmd *user.CreateUserCommand) error {
	var usr *user.User
	err := ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		sess.UseBool("is_admin")

		if _, err := sess.Insert(usr); err != nil {
			return err
		}

		sess.PublishAfterCommit(&events.UserCreated{
			Timestamp: usr.Created,
			Id:        usr.ID,
			Name:      usr.Name,
			Login:     usr.Login,
			Email:     usr.Email,
		})
		return nil
	})
	return err
}

func (ss *sqlStore) Insert(ctx context.Context, cmd *models.OrgUser) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(&cmd); err != nil {
			return err
		}

		return nil
	})
}

func (ss *sqlStore) Get(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	exists, err := ss.sess.Where("email=? OR login=?", cmd.Email, cmd.Login).Get(&user.User{})
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, models.ErrUserAlreadyExists
	}

	// create user
	usr := &user.User{
		Email:            cmd.Email,
		Name:             cmd.Name,
		Login:            cmd.Login,
		Company:          cmd.Company,
		IsAdmin:          cmd.IsAdmin,
		IsDisabled:       cmd.IsDisabled,
		OrgID:            cmd.OrgID,
		EmailVerified:    cmd.EmailVerified,
		Created:          time.Now(),
		Updated:          time.Now(),
		LastSeenAt:       time.Now().AddDate(-10, 0, 0),
		IsServiceAccount: cmd.IsServiceAccount,
	}
	return usr, nil
}

package userimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/user"
)

type store interface {
	Insert(context.Context, *user.User) (int64, error)
	Get(context.Context, *user.User) (*user.User, error)
}

type sqlStore struct {
	db db.DB
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

func (ss *sqlStore) Get(ctx context.Context, cmd *user.User) (*user.User, error) {
	var usr *user.User
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		exists, err := sess.Where("email=? OR login=?", cmd.Email, cmd.Login).Get(&user.User{})
		if !exists {
			return models.ErrUserNotFound
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

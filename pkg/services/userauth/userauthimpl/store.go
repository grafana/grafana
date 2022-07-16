package userauthimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type store interface {
	Delete(context.Context, int64) error
	DeleteToken(context.Context, int64) error
}

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) Delete(ctx context.Context, userID int64) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var rawSQL = "DELETE FROM user_auth WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
}

func (ss *sqlStore) DeleteToken(ctx context.Context, userID int64) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var rawSQL = "DELETE FROM user_auth_token WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
}

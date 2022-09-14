package quotaimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type store interface {
	DeleteByUser(context.Context, int64) error
}

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) DeleteByUser(ctx context.Context, userID int64) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var rawSQL = "DELETE FROM quota WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
}

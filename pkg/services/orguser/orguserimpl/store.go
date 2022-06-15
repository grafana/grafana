package orguserimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/orguser"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type store interface {
	Insert(context.Context, *orguser.OrgUser) error
}

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) Insert(ctx context.Context, cmd *orguser.OrgUser) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Insert(cmd); err != nil {
			return err
		}
		return nil
	})
}

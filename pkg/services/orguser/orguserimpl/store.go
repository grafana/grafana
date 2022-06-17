package orguserimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/orguser"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type store interface {
	Insert(context.Context, *orguser.OrgUser) (int64, error)
}

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) Insert(ctx context.Context, cmd *orguser.OrgUser) (int64, error) {
	var orgID int64
	var err error
	err = ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if orgID, err = sess.Insert(cmd); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return orgID, nil
}

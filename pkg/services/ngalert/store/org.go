package store

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
)

type OrgStore interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
}

func (st DBstore) FetchOrgIds(ctx context.Context) ([]int64, error) {
	orgs := make([]int64, 0)
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		q := "SELECT id FROM org"
		if err := sess.SQL(q).Find(&orgs); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return orgs, nil
}

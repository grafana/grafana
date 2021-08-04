package store

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type OrgStore interface {
	GetOrgs() ([]int64, error)
}

func (st DBstore) GetOrgs() ([]int64, error) {
	orgs := make([]int64, 0)
	err := st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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

package orguserimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/orguser"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type Service struct {
	store store
}

func ProvideService(db db.DB) orguser.Service {
	return &Service{
		store: &sqlStore{
			db: db,
		},
	}
}

func (s *Service) Insert(ctx context.Context, orguser *orguser.OrgUser) (int64, error) {
	return s.store.Insert(ctx, orguser)
}

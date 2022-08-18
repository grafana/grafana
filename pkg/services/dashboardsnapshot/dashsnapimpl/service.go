package dashsnapimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/components/simplejson"
	dashsnapshot "github.com/grafana/grafana/pkg/services/dashboardsnapshot"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type ServiceImpl struct {
	store          store
	secretsService secrets.Service
}

func ProvideService(db db.DB, secretsService secrets.Service) *ServiceImpl {

	s := &ServiceImpl{
		store:          ProvideStore(db),
		secretsService: secretsService,
	}

	return s
}

func (s *ServiceImpl) CreateDashboardSnapshot(ctx context.Context, cmd *dashsnapshot.CreateDashboardSnapshotCommand) error {
	marshalledData, err := cmd.Dashboard.Encode()
	if err != nil {
		return err
	}

	encryptedDashboard, err := s.secretsService.Encrypt(ctx, marshalledData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	cmd.DashboardEncrypted = encryptedDashboard

	return s.store.CreateDashboardSnapshot(ctx, cmd)
}

func (s *ServiceImpl) GetDashboardSnapshot(ctx context.Context, query *dashsnapshot.GetDashboardSnapshotQuery) error {
	err := s.store.GetDashboardSnapshot(ctx, query)
	if err != nil {
		return err
	}

	if query.Result.DashboardEncrypted != nil {
		decryptedDashboard, err := s.secretsService.Decrypt(ctx, query.Result.DashboardEncrypted)
		if err != nil {
			return err
		}

		dashboard, err := simplejson.NewJson(decryptedDashboard)
		if err != nil {
			return err
		}

		query.Result.Dashboard = dashboard
	}

	return err
}

func (s *ServiceImpl) DeleteDashboardSnapshot(ctx context.Context, cmd *dashsnapshot.DeleteDashboardSnapshotCommand) error {
	return s.store.DeleteDashboardSnapshot(ctx, cmd)
}

func (s *ServiceImpl) SearchDashboardSnapshots(ctx context.Context, query *dashsnapshot.GetDashboardSnapshotsQuery) error {
	return s.store.SearchDashboardSnapshots(ctx, query)
}

func (s *ServiceImpl) DeleteExpiredSnapshots(ctx context.Context, cmd *dashsnapshot.DeleteExpiredSnapshotsCommand) error {
	return s.store.DeleteExpiredSnapshots(ctx, cmd)
}

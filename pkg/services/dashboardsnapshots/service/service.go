package service

import (
	"context"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/secrets"
)

type ServiceImpl struct {
	store          dashboardsnapshots.Store
	secretsService secrets.Service
}

// ServiceImpl implements the dashboardsnapshots Service interface
var _ dashboardsnapshots.Service = (*ServiceImpl)(nil)

func ProvideService(store dashboardsnapshots.Store, secretsService secrets.Service) *ServiceImpl {
	s := &ServiceImpl{
		store:          store,
		secretsService: secretsService,
	}

	return s
}

func (s *ServiceImpl) CreateDashboardSnapshot(ctx context.Context, cmd *dashboardsnapshots.CreateDashboardSnapshotCommand) error {
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

func (s *ServiceImpl) GetDashboardSnapshot(ctx context.Context, query *dashboardsnapshots.GetDashboardSnapshotQuery) error {
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

func (s *ServiceImpl) DeleteDashboardSnapshot(ctx context.Context, cmd *dashboardsnapshots.DeleteDashboardSnapshotCommand) error {
	return s.store.DeleteDashboardSnapshot(ctx, cmd)
}

func (s *ServiceImpl) SearchDashboardSnapshots(ctx context.Context, query *dashboardsnapshots.GetDashboardSnapshotsQuery) error {
	return s.store.SearchDashboardSnapshots(ctx, query)
}

func (s *ServiceImpl) DeleteExpiredSnapshots(ctx context.Context, cmd *dashboardsnapshots.DeleteExpiredSnapshotsCommand) error {
	return s.store.DeleteExpiredSnapshots(ctx, cmd)
}

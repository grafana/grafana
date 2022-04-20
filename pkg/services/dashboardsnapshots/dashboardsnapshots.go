package dashboardsnapshots

import (
	"context"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Service struct {
	SQLStore       sqlstore.Store
	SecretsService secrets.Service
}

func ProvideService(store sqlstore.Store, secretsService secrets.Service) *Service {
	s := &Service{
		SQLStore:       store,
		SecretsService: secretsService,
	}

	return s
}

func (s *Service) CreateDashboardSnapshot(ctx context.Context, cmd *models.CreateDashboardSnapshotCommand) error {
	marshalledData, err := cmd.Dashboard.Encode()
	if err != nil {
		return err
	}

	encryptedDashboard, err := s.SecretsService.Encrypt(ctx, marshalledData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	cmd.DashboardEncrypted = encryptedDashboard

	return s.SQLStore.CreateDashboardSnapshot(ctx, cmd)
}

func (s *Service) GetDashboardSnapshot(ctx context.Context, query *models.GetDashboardSnapshotQuery) error {
	err := s.SQLStore.GetDashboardSnapshot(query)
	if err != nil {
		return err
	}

	if query.Result.DashboardEncrypted != nil {
		decryptedDashboard, err := s.SecretsService.Decrypt(ctx, query.Result.DashboardEncrypted)
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

func (s *Service) DeleteDashboardSnapshot(ctx context.Context, cmd *models.DeleteDashboardSnapshotCommand) error {
	return s.SQLStore.DeleteDashboardSnapshot(ctx, cmd)
}

func (s *Service) SearchDashboardSnapshots(_ context.Context, query *models.GetDashboardSnapshotsQuery) error {
	return s.SQLStore.SearchDashboardSnapshots(query)
}

func (s *Service) DeleteExpiredSnapshots(ctx context.Context, cmd *models.DeleteExpiredSnapshotsCommand) error {
	return s.SQLStore.DeleteExpiredSnapshots(ctx, cmd)
}

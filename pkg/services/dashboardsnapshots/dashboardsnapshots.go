package dashboardsnapshots

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Service struct {
	Bus            bus.Bus
	SQLStore       *sqlstore.SQLStore
	SecretsService secrets.SecretsService
}

func ProvideService(bus bus.Bus, store *sqlstore.SQLStore, secretsService secrets.SecretsService) *Service {
	s := &Service{
		Bus:            bus,
		SQLStore:       store,
		SecretsService: secretsService,
	}

	s.Bus.AddHandlerCtx(s.CreateDashboardSnapshot)
	s.Bus.AddHandlerCtx(s.GetDashboardSnapshot)
	s.Bus.AddHandlerCtx(s.DeleteDashboardSnapshot)
	s.Bus.AddHandlerCtx(s.SearchDashboardSnapshots)
	s.Bus.AddHandlerCtx(s.DeleteExpiredSnapshots)

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

	return s.SQLStore.CreateDashboardSnapshot(cmd)
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

func (s *Service) DeleteDashboardSnapshot(_ context.Context, cmd *models.DeleteDashboardSnapshotCommand) error {
	return s.SQLStore.DeleteDashboardSnapshot(cmd)
}

func (s *Service) SearchDashboardSnapshots(_ context.Context, query *models.GetDashboardSnapshotsQuery) error {
	return s.SQLStore.SearchDashboardSnapshots(query)
}

func (s *Service) DeleteExpiredSnapshots(_ context.Context, cmd *models.DeleteExpiredSnapshotsCommand) error {
	return s.SQLStore.DeleteExpiredSnapshots(cmd)
}

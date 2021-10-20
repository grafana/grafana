package dashboardsnapshots

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	Bus               bus.Bus
	SQLStore          *sqlstore.SQLStore
	EncryptionService encryption.Service
}

func ProvideService(bus bus.Bus, store *sqlstore.SQLStore, encryptionService encryption.Service) *Service {
	s := &Service{
		Bus:               bus,
		SQLStore:          store,
		EncryptionService: encryptionService,
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

	encryptedDashboard, err := s.EncryptionService.Encrypt(ctx, marshalledData, setting.SecretKey)
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
		decryptedDashboard, err := s.EncryptionService.Decrypt(ctx, query.Result.DashboardEncrypted, setting.SecretKey)
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

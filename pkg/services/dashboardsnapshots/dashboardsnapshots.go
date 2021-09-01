package dashboardsnapshots

import (
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

	s.Bus.AddHandler(s.CreateDashboardSnapshot)
	s.Bus.AddHandler(s.GetDashboardSnapshot)
	s.Bus.AddHandler(s.DeleteDashboardSnapshot)
	s.Bus.AddHandler(s.SearchDashboardSnapshots)
	s.Bus.AddHandler(s.DeleteExpiredSnapshots)

	return s
}

func (s *Service) CreateDashboardSnapshot(cmd *models.CreateDashboardSnapshotCommand) error {
	marshalledData, err := cmd.Dashboard.Encode()
	if err != nil {
		return err
	}

	encryptedDashboard, err := s.EncryptionService.Encrypt(marshalledData, setting.SecretKey)
	if err != nil {
		return err
	}

	cmd.DashboardEncrypted = encryptedDashboard

	return s.SQLStore.CreateDashboardSnapshot(cmd)
}

func (s *Service) GetDashboardSnapshot(query *models.GetDashboardSnapshotQuery) error {
	err := s.SQLStore.GetDashboardSnapshot(query)
	if err != nil {
		return err
	}

	if query.Result.DashboardEncrypted != nil {
		decryptedDashboard, err := s.EncryptionService.Decrypt(query.Result.DashboardEncrypted, setting.SecretKey)
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

func (s *Service) DeleteDashboardSnapshot(cmd *models.DeleteDashboardSnapshotCommand) error {
	return s.SQLStore.DeleteDashboardSnapshot(cmd)
}

func (s *Service) SearchDashboardSnapshots(query *models.GetDashboardSnapshotsQuery) error {
	return s.SQLStore.SearchDashboardSnapshots(query)
}

func (s *Service) DeleteExpiredSnapshots(cmd *models.DeleteExpiredSnapshotsCommand) error {
	return s.SQLStore.DeleteExpiredSnapshots(cmd)
}

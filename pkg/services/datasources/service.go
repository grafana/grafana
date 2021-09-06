package datasources

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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

	s.Bus.AddHandler(s.GetDataSources)
	s.Bus.AddHandler(s.GetDataSourcesByType)
	s.Bus.AddHandler(s.GetDataSource)
	s.Bus.AddHandler(s.AddDataSource)
	s.Bus.AddHandler(s.DeleteDataSource)
	s.Bus.AddHandler(s.UpdateDataSource)
	s.Bus.AddHandler(s.GetDefaultDataSource)

	return s
}

func (s *Service) GetDataSource(query *models.GetDataSourceQuery) error {
	return s.SQLStore.GetDataSource(query)
}

func (s *Service) GetDataSources(query *models.GetDataSourcesQuery) error {
	return s.SQLStore.GetDataSources(query)
}

func (s *Service) GetDataSourcesByType(query *models.GetDataSourcesByTypeQuery) error {
	return s.SQLStore.GetDataSourcesByType(query)
}

func (s *Service) AddDataSource(cmd *models.AddDataSourceCommand) error {
	return s.SQLStore.AddDataSource(cmd)
}

func (s *Service) DeleteDataSource(cmd *models.DeleteDataSourceCommand) error {
	return s.SQLStore.DeleteDataSource(cmd)
}

func (s *Service) UpdateDataSource(cmd *models.UpdateDataSourceCommand) error {
	return s.SQLStore.UpdateDataSource(cmd)
}

func (s *Service) GetDefaultDataSource(query *models.GetDefaultDataSourceQuery) error {
	return s.SQLStore.GetDefaultDataSource(query)
}

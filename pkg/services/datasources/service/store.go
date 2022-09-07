package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// Store is the interface for the datasource Service's storage.
type Store interface {
	GetDataSource(context.Context, *datasources.GetDataSourceQuery) error
	GetDataSources(context.Context, *datasources.GetDataSourcesQuery) error
	GetDataSourcesByType(context.Context, *datasources.GetDataSourcesByTypeQuery) error
	GetDefaultDataSource(context.Context, *datasources.GetDefaultDataSourceQuery) error
	DeleteDataSource(context.Context, *datasources.DeleteDataSourceCommand) error
	AddDataSource(context.Context, *datasources.AddDataSourceCommand) error
	UpdateDataSource(context.Context, *datasources.UpdateDataSourceCommand) error
	GetAllDataSources(ctx context.Context, query *datasources.GetAllDataSourcesQuery) error
}

func CreateStore(db sqlstore.Store, logger log.Logger) Store {
	return &SqlStore{db: db, logger: logger}
}

var generateNewUid func() string = util.GenerateShortUID

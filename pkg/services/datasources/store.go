package datasources

import (
	"context"
)

// Store is the interface for the datasource Service's storage.
type Store interface {
	GetDataSource(context.Context, *GetDataSourceQuery) error
	GetDataSources(context.Context, *GetDataSourcesQuery) error
	GetDataSourcesByType(context.Context, *GetDataSourcesByTypeQuery) error
	GetDefaultDataSource(context.Context, *GetDefaultDataSourceQuery) error
	DeleteDataSource(context.Context, *DeleteDataSourceCommand) error
	AddDataSource(context.Context, *AddDataSourceCommand) error
	UpdateDataSource(context.Context, *UpdateDataSourceCommand) error
}

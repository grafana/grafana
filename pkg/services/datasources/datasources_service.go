package datasources

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type datasourceSql interface {
	GetDataSourceById(id int64, orgId int64) (*models.DataSource, error)
}

type datasourceService struct {
	sqlStore *sqlstore.SqlStore
	sql      datasourceSql
	ctx      context.Context
}

func NewDatasourceService(ctx context.Context, sqlStore *sqlstore.SqlStore) *datasourceService {
	ds := &datasourceService{}
	ds.ctx = ctx
	ds.sql = &datasourceSqlImpl{sqlStore: sqlStore, ctx: ds.ctx}
	return ds
}

func (ds *datasourceService) GetDataSourceById(id int64, orgId int64) (*models.DataSource, error) {
	return ds.sql.GetDataSourceById(id, orgId)
}

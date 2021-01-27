package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type TsdbQueryEndpoint interface {
	Query(ctx context.Context, ds *models.DataSource, query *TsdbQuery) (*Response, error)
}

var registry map[string]GetTSDBQueryEndpointFn

type GetTSDBQueryEndpointFn func(dsInfo *models.DataSource, cfg *setting.Cfg) (TsdbQueryEndpoint, error)

func init() {
	registry = make(map[string]GetTSDBQueryEndpointFn)
}

func RegisterTSDBQueryEndpoint(pluginId string, fn GetTSDBQueryEndpointFn) {
	registry[pluginId] = fn
}

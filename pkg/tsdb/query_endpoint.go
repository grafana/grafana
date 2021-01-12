package tsdb

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type TsdbQueryEndpoint interface {
	Query(ctx context.Context, ds *models.DataSource, query *TsdbQuery) (*Response, error)
}

var registry map[string]GetTsdbQueryEndpointFn

type GetTsdbQueryEndpointFn func(dsInfo *models.DataSource) (TsdbQueryEndpoint, error)

func init() {
	registry = make(map[string]GetTsdbQueryEndpointFn)
}

func RegisterTsdbQueryEndpoint(pluginId string, fn GetTsdbQueryEndpointFn) {
	registry[pluginId] = fn
}

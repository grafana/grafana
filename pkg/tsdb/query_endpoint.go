package tsdb

import (
	"context"
	"fmt"

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

func getTsdbQueryEndpointFor(dsInfo *models.DataSource) (TsdbQueryEndpoint, error) {
	if fn, exists := registry[dsInfo.Type]; exists {
		executor, err := fn(dsInfo)
		if err != nil {
			return nil, err
		}

		return executor, nil
	}
	return nil, fmt.Errorf("Could not find executor for data source type: %s", dsInfo.Type)
}

func RegisterTsdbQueryEndpoint(pluginId string, fn GetTsdbQueryEndpointFn) {
	registry[pluginId] = fn
}

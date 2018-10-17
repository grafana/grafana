package tsdb

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type TsdbEndpoint interface {
	Query(ctx context.Context, ds *models.DataSource, query *TsdbQuery) (*Response, error)
	Validate(proxyPath string, ctx *models.ReqContext, dsInfo *models.DataSource) error
}

var registry map[string]GetTsdbEndpointFn

type GetTsdbEndpointFn func(dsInfo *models.DataSource) (TsdbEndpoint, error)

func init() {
	registry = make(map[string]GetTsdbEndpointFn)
}

func getTsdbEndpointFor(dsInfo *models.DataSource) (TsdbEndpoint, error) {
	if fn, exists := registry[dsInfo.Type]; exists {
		executor, err := fn(dsInfo)
		if err != nil {
			return nil, err
		}

		return executor, nil
	}
	return nil, fmt.Errorf("Could not find executor for data source type: %s", dsInfo.Type)
}

func RegisterTsdbEndpoint(pluginId string, fn GetTsdbEndpointFn) {
	registry[pluginId] = fn
}

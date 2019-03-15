package tsdb

import (
	"context"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/models"
)

type HandleRequestFunc func(ctx context.Context, dsInfo *models.DataSource, req *TsdbQuery, cfg *setting.Cfg) (*Response, error)

func HandleRequest(ctx context.Context, dsInfo *models.DataSource, req *TsdbQuery, cfg *setting.Cfg) (*Response, error) {
	endpoint, err := getTsdbQueryEndpointFor(dsInfo, cfg)
	if err != nil {
		return nil, err
	}

	return endpoint.Query(ctx, dsInfo, req)
}

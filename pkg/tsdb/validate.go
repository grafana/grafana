package tsdb

import (
	"github.com/grafana/grafana/pkg/models"
)

type ValidateRequestFunc func(proxyPath string, ctx *models.ReqContext, dsInfo *models.DataSource) error

func ValidateRequest(proxyPath string, ctx *models.ReqContext, dsInfo *models.DataSource) error {
	endpoint, err := getTsdbEndpointFor(dsInfo)
	if err != nil {
		return err
	}

	return endpoint.Validate(proxyPath, ctx, dsInfo)
}

package api

import (
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func getDatasource(id int64, orgId int64) (*m.DataSource, error) {
	query := m.GetDataSourceByIdQuery{Id: id, OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

func ProxyDataSourceRequest(c *middleware.Context) {
	c.TimeRequest(metrics.M_DataSource_ProxyReq_Timer)

	ds, err := getDatasource(c.ParamsInt64(":id"), c.OrgId)

	if err != nil {
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	proxyPath := c.Params("*")
	proxy := pluginproxy.NewDataSourceProxy(ds, c, proxyPath)
	proxy.HandleRequest()
}

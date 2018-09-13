package api

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

const HeaderNameNoBackendCache = "X-Grafana-NoCache"

func (hs *HTTPServer) getDatasourceFromCache(id int64, c *m.ReqContext) (*m.DataSource, error) {
	nocache := c.Req.Header.Get(HeaderNameNoBackendCache) == "true"
	cacheKey := fmt.Sprintf("ds-%d", id)

	if !nocache {
		if cached, found := hs.cache.Get(cacheKey); found {
			ds := cached.(*m.DataSource)
			if ds.OrgId == c.OrgId {
				return ds, nil
			}
		}
	}

	query := m.GetDataSourceByIdQuery{Id: id, OrgId: c.OrgId}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	hs.cache.Set(cacheKey, query.Result, time.Second*5)
	return query.Result, nil
}

func (hs *HTTPServer) ProxyDataSourceRequest(c *m.ReqContext) {
	c.TimeRequest(metrics.M_DataSource_ProxyReq_Timer)

	ds, err := hs.getDatasourceFromCache(c.ParamsInt64(":id"), c)
	if err != nil {
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	// find plugin
	plugin, ok := plugins.DataSources[ds.Type]
	if !ok {
		c.JsonApiErr(500, "Unable to find datasource plugin", err)
		return
	}

	proxyPath := c.Params("*")
	proxy := pluginproxy.NewDataSourceProxy(ds, plugin, c, proxyPath)
	proxy.HandleRequest()
}

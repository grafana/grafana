package api

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
)

const HeaderNameNoBackendCache = "X-Grafana-NoCache"

func (hs *HTTPServer) getDatasourceByID(id int64, orgID int64, nocache bool) (*m.DataSource, error) {
	cacheKey := fmt.Sprintf("ds-%d", id)

	if !nocache {
		if cached, found := hs.cache.Get(cacheKey); found {
			ds := cached.(*m.DataSource)
			if ds.OrgId == orgID {
				return ds, nil
			}
		}
	}

	query := m.GetDataSourceByIdQuery{Id: id, OrgId: orgID}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	hs.cache.Set(cacheKey, query.Result, time.Second*5)
	return query.Result, nil
}

func (hs *HTTPServer) ProxyDataSourceRequest(c *m.ReqContext) {
	c.TimeRequest(metrics.M_DataSource_ProxyReq_Timer)

	nocache := c.Req.Header.Get(HeaderNameNoBackendCache) == "true"

	ds, err := hs.getDatasourceByID(c.ParamsInt64(":id"), c.OrgId, nocache)

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
	//code change
	//add label to expr
	if ds.Type == m.DS_PROMETHEUS && (proxyPath == "api/v1/query" || proxyPath == "api/v1/query_range") {
		orgQuery := m.GetOrgByIdQuery{Id: c.OrgId}
		if err := bus.Dispatch(&orgQuery); err != nil { return }

		tlabel := orgQuery.Result.Tenantlabel
		tlabelValue := orgQuery.Result.Tenantvalue
		if "" != tlabel && "" != tlabelValue {
			query := c.Query("query")
            c.Req.Form.Set("query", util.ParseExpr(query, tlabel, tlabelValue))
			c.Req.URL.RawQuery = c.Req.Form.Encode()
			//for log
			c.Req.RequestURI = c.Req.URL.RequestURI()
		}
	}//end if
	//end code change

	proxy := pluginproxy.NewDataSourceProxy(ds, plugin, c, proxyPath)
	proxy.HandleRequest()
}

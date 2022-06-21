package api

import "github.com/grafana/grafana/pkg/models"

func (hs *HTTPServer) ProxyDataSourceRequest(c *models.ReqContext) {
	hs.DataProxy.ProxyDataSourceRequest(c)
}

func (hs *HTTPServer) ProxyDataSourceRequestWithUID(c *models.ReqContext) {
	hs.DataProxy.ProxyDatasourceRequestWithUID(c, "")
}

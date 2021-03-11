package dataproxy

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

type DataProxy struct {
	DatasourceCache        datasources.CacheService
	PluginRequestValidator models.PluginRequestValidator
	Cfg                    *setting.Cfg
}

func (p *DataProxy) ProxyDataSourceRequest(c *models.ReqContext) {
	p.ProxyDatasourceRequestWithID(c, c.ParamsInt64(":id"))
}

func (p *DataProxy) ProxyDatasourceRequestWithID(c *models.ReqContext, dsID int64) {
	c.TimeRequest(metrics.MDataSourceProxyReqTimer)

	ds, err := p.DatasourceCache.GetDatasource(dsID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			c.JsonApiErr(http.StatusForbidden, "Access denied to datasource", err)
			return
		}
		c.JsonApiErr(http.StatusInternalServerError, "Unable to load datasource meta data", err)
		return
	}

	err = p.PluginRequestValidator.Validate(ds.Url, c.Req.Request)
	if err != nil {
		c.JsonApiErr(http.StatusForbidden, "Access denied", err)
		return
	}

	// find plugin
	plugin, ok := manager.DataSources[ds.Type]
	if !ok {
		c.JsonApiErr(http.StatusInternalServerError, "Unable to find datasource plugin", err)
		return
	}

	// macaron does not include trailing slashes when resolving a wildcard path
	proxyPath := EnsureProxyPathTrailingSlash(c.Req.URL.Path, c.Params("*"))

	proxy, err := pluginproxy.NewDataSourceProxy(ds, plugin, c, proxyPath, p.Cfg)
	if err != nil {
		if errors.Is(err, datasource.URLValidationError{}) {
			c.JsonApiErr(http.StatusBadRequest, fmt.Sprintf("Invalid data source URL: %q", ds.Url), err)
		} else {
			c.JsonApiErr(http.StatusInternalServerError, "Failed creating data source proxy", err)
		}
		return
	}
	proxy.HandleRequest()

}

// ensureProxyPathTrailingSlash Check for a trailing slash in original path and makes
// sure that a trailing slash is added to proxy path, if not already exists.
func EnsureProxyPathTrailingSlash(originalPath, proxyPath string) string {
	if len(proxyPath) > 1 {
		if originalPath[len(originalPath)-1] == '/' && proxyPath[len(proxyPath)-1] != '/' {
			return proxyPath + "/"
		}
	}

	return proxyPath
}

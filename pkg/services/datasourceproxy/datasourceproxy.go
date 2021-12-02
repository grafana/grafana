package datasourceproxy

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(dataSourceCache datasources.CacheService, plugReqValidator models.PluginRequestValidator,
	pluginStore plugins.Store, cfg *setting.Cfg, httpClientProvider httpclient.Provider,
	oauthTokenService *oauthtoken.Service, dsService *datasources.Service) *DataSourceProxyService {
	return &DataSourceProxyService{
		DataSourceCache:        dataSourceCache,
		PluginRequestValidator: plugReqValidator,
		pluginStore:            pluginStore,
		Cfg:                    cfg,
		HTTPClientProvider:     httpClientProvider,
		OAuthTokenService:      oauthTokenService,
		DataSourcesService:     dsService,
	}
}

type DataSourceProxyService struct {
	DataSourceCache        datasources.CacheService
	PluginRequestValidator models.PluginRequestValidator
	pluginStore            plugins.Store
	Cfg                    *setting.Cfg
	HTTPClientProvider     httpclient.Provider
	OAuthTokenService      *oauthtoken.Service
	DataSourcesService     *datasources.Service
}

func (p *DataSourceProxyService) ProxyDataSourceRequest(c *models.ReqContext) {
	p.ProxyDatasourceRequestWithID(c, c.ParamsInt64(":id"))
}

func (p *DataSourceProxyService) ProxyDatasourceRequestWithID(c *models.ReqContext, dsID int64) {
	c.TimeRequest(metrics.MDataSourceProxyReqTimer)

	ds, err := p.DataSourceCache.GetDatasource(dsID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if errors.Is(err, models.ErrDataSourceAccessDenied) {
			c.JsonApiErr(http.StatusForbidden, "Access denied to datasource", err)
			return
		}
		if errors.Is(err, models.ErrDataSourceNotFound) {
			c.JsonApiErr(http.StatusNotFound, "Unable to find datasource", err)
			return
		}
		c.JsonApiErr(http.StatusInternalServerError, "Unable to load datasource meta data", err)
		return
	}

	err = p.PluginRequestValidator.Validate(ds.Url, c.Req)
	if err != nil {
		c.JsonApiErr(http.StatusForbidden, "Access denied", err)
		return
	}

	// find plugin
	plugin, exists := p.pluginStore.Plugin(c.Req.Context(), ds.Type)
	if !exists {
		c.JsonApiErr(http.StatusNotFound, "Unable to find datasource plugin", err)
		return
	}

	proxyPath := getProxyPath(c)
	proxy, err := pluginproxy.NewDataSourceProxy(ds, plugin.Routes, c, proxyPath, p.Cfg, p.HTTPClientProvider,
		p.OAuthTokenService, p.DataSourcesService)
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

var proxyPathRegexp = regexp.MustCompile(`^\/api\/datasources\/proxy\/[\d]+\/?`)

func extractProxyPath(originalRawPath string) string {
	return proxyPathRegexp.ReplaceAllString(originalRawPath, "")
}

func getProxyPath(c *models.ReqContext) string {
	return extractProxyPath(c.Req.URL.EscapedPath())
}

package datasourceproxy

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func ProvideService(dataSourceCache datasources.CacheService, datasourceReqValidator validations.DataSourceRequestValidator,
	pluginStore pluginstore.Store, cfg *setting.Cfg, httpClientProvider httpclient.Provider,
	oauthTokenService *oauthtoken.Service, dsService datasources.DataSourceService,
	tracer tracing.Tracer, secretsService secrets.Service, features featuremgmt.FeatureToggles,
) *DataSourceProxyService {
	return &DataSourceProxyService{
		DataSourceCache:            dataSourceCache,
		DataSourceRequestValidator: datasourceReqValidator,
		pluginStore:                pluginStore,
		Cfg:                        cfg,
		HTTPClientProvider:         httpClientProvider,
		OAuthTokenService:          oauthTokenService,
		DataSourcesService:         dsService,
		tracer:                     tracer,
		secretsService:             secretsService,
		features:                   features,
	}
}

type DataSourceProxyService struct {
	DataSourceCache            datasources.CacheService
	DataSourceRequestValidator validations.DataSourceRequestValidator
	pluginStore                pluginstore.Store
	Cfg                        *setting.Cfg
	HTTPClientProvider         httpclient.Provider
	OAuthTokenService          *oauthtoken.Service
	DataSourcesService         datasources.DataSourceService
	tracer                     tracing.Tracer
	secretsService             secrets.Service
	features                   featuremgmt.FeatureToggles
}

func (p *DataSourceProxyService) ProxyDataSourceRequest(c *contextmodel.ReqContext) {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "id is invalid", err)
		return
	}
	p.ProxyDatasourceRequestWithID(c, id)
}

func (p *DataSourceProxyService) ProxyDatasourceRequestWithUID(c *contextmodel.ReqContext, dsUID string) {
	c.TimeRequest(metrics.MDataSourceProxyReqTimer)

	if dsUID == "" { // if datasource UID is not provided, fetch it from the uid path parameter
		dsUID = web.Params(c.Req)[":uid"]
	}

	if !util.IsValidShortUID(dsUID) {
		c.JsonApiErr(http.StatusBadRequest, "UID is invalid", nil)
		return
	}

	ds, err := p.DataSourceCache.GetDatasourceByUID(c.Req.Context(), dsUID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		toAPIError(c, err)
		return
	}
	p.proxyDatasourceRequest(c, ds)
}

func (p *DataSourceProxyService) ProxyDatasourceRequestWithID(c *contextmodel.ReqContext, dsID int64) {
	c.TimeRequest(metrics.MDataSourceProxyReqTimer)

	ds, err := p.DataSourceCache.GetDatasource(c.Req.Context(), dsID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		toAPIError(c, err)
		return
	}
	p.proxyDatasourceRequest(c, ds)
}

func toAPIError(c *contextmodel.ReqContext, err error) {
	if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
		c.JsonApiErr(http.StatusForbidden, "Access denied to datasource", err)
		return
	}
	if errors.Is(err, datasources.ErrDataSourceNotFound) {
		c.JsonApiErr(http.StatusNotFound, "Unable to find datasource", err)
		return
	}
	c.JsonApiErr(http.StatusInternalServerError, "Unable to load datasource meta data", err)
}

func (p *DataSourceProxyService) proxyDatasourceRequest(c *contextmodel.ReqContext, ds *datasources.DataSource) {
	err := p.DataSourceRequestValidator.Validate(ds, c.Req)
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
		p.OAuthTokenService, p.DataSourcesService, p.tracer, p.features)
	if err != nil {
		var urlValidationError datasource.URLValidationError
		if errors.As(err, &urlValidationError) {
			c.JsonApiErr(http.StatusBadRequest, fmt.Sprintf("Invalid data source URL: %q", ds.URL), err)
		} else {
			c.JsonApiErr(http.StatusInternalServerError, "Failed creating data source proxy", err)
		}
		return
	}
	proxy.HandleRequest()
}

var proxyPathRegexp = regexp.MustCompile(`^\/api\/datasources\/proxy\/([\d]+|uid\/[\w-]+)\/?`)

func extractProxyPath(originalRawPath string) string {
	return proxyPathRegexp.ReplaceAllString(originalRawPath, "")
}

func getProxyPath(c *contextmodel.ReqContext) string {
	return extractProxyPath(c.Req.URL.EscapedPath())
}

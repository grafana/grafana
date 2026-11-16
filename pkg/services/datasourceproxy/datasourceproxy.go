package datasourceproxy

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/datasource/validation"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasourceproxy/proxymetrics"
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
	tracer tracing.Tracer,
	secretsService secrets.Service, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	features featuremgmt.FeatureToggles,
) *DataSourceProxyService {
	return &DataSourceProxyService{
		DataSourceCache:            dataSourceCache,
		DataSourceRequestValidator: datasourceReqValidator,
		pluginStore:                pluginStore,
		proxyCfg:                   pluginproxy.NewDataSourceProxySettings(cfg),
		HTTPClientProvider:         httpClientProvider,
		OAuthTokenService:          oauthTokenService,
		DataSourcesService:         dsService,
		tracer:                     tracer,
		secretsService:             secretsService,
		features:                   features,
		metrics:                    proxymetrics.ForVariant(proxymetrics.VariantLegacy),
	}
}

type DataSourceProxyService struct {
	DataSourceCache            datasources.CacheService
	DataSourceRequestValidator validations.DataSourceRequestValidator
	pluginStore                pluginstore.Store
	proxyCfg                   *pluginproxy.DataSourceProxySettings
	HTTPClientProvider         httpclient.Provider
	OAuthTokenService          *oauthtoken.Service
	DataSourcesService         datasources.DataSourceService
	tracer                     tracing.Tracer
	secretsService             secrets.Service //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	features                   featuremgmt.FeatureToggles
	metrics                    *proxymetrics.Metrics
}

// proxyObservation records one proxied request when it finishes, whichever way it ends.
type proxyObservation struct {
	metrics  *proxymetrics.Metrics
	c        *contextmodel.ReqContext
	start    time.Time
	pluginID string
}

func (p *DataSourceProxyService) observe(c *contextmodel.ReqContext) *proxyObservation {
	return &proxyObservation{metrics: p.metrics, c: c, start: time.Now()}
}

func (o *proxyObservation) finish() {
	if o.metrics == nil || o.c.Resp == nil {
		return
	}
	status := o.c.Resp.Status()
	o.metrics.Observe(proxymetrics.Observation{
		PluginID: o.pluginID,
		Method:   o.c.Req.Method,
		Path:     getProxyPath(o.c),
		Status:   status,
		Source:   proxymetrics.ClassifySource(status, requestmeta.GetRequestMetaData(o.c.Req.Context()).StatusSource),
		Duration: time.Since(o.start),
	})
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
	obs := p.observe(c)
	defer obs.finish()

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
	p.proxyDatasourceRequest(c, ds, obs)
}

func (p *DataSourceProxyService) ProxyDatasourceRequestWithID(c *contextmodel.ReqContext, dsID int64) {
	c.TimeRequest(metrics.MDataSourceProxyReqTimer)
	obs := p.observe(c)
	defer obs.finish()

	ds, err := p.DataSourceCache.GetDatasource(c.Req.Context(), dsID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		toAPIError(c, err)
		return
	}
	p.proxyDatasourceRequest(c, ds, obs)
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

func (p *DataSourceProxyService) proxyDatasourceRequest(c *contextmodel.ReqContext, ds *datasources.DataSource, obs *proxyObservation) {
	obs.pluginID = ds.Type
	err := p.DataSourceRequestValidator.Validate(ds.URL, ds.JsonDataMap(), c.Req)
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

	loader, err := pluginproxy.NewDataSourceLoader(ds, p.DataSourcesService)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Failed creating data source loader", err)
		return
	}

	hc := pluginproxy.HTTPContext{
		Req:  c.Req,
		Resp: c.Resp,

		UserToken: c.UserToken,
	}

	proxyPath := getProxyPath(c)
	// Single-tenant Grafana mints its own id token at the edge, so requester always carries one
	// and the derive fallback is never needed on this classic monolith path.
	proxy, err := pluginproxy.NewDataSourceProxy(loader, plugin.Routes, hc, proxyPath, p.proxyCfg,
		p.HTTPClientProvider, p.OAuthTokenService, p.tracer, p.features, nil, nil)
	if err != nil {
		if _, ok := errors.AsType[validation.URLValidationError](err); ok {
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

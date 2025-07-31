package clientmiddleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"

	"github.com/google/uuid"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const (
	GrafanaRequestID       = "X-Grafana-Request-Id"
	GrafanaSignedRequestID = "X-Grafana-Signed-Request-Id"
	XRealIPHeader          = "X-Real-Ip"
	GrafanaInternalRequest = "X-Grafana-Internal-Request"
)

// NewHostedGrafanaACHeaderMiddleware creates a new backend.HandlerMiddleware that will
// generate a random request ID, sign it using internal key and populate X-Grafana-Request-ID with the request ID
// and X-Grafana-Signed-Request-ID with signed request ID. We can then use this to verify that the request
// is coming from hosted Grafana and is not an external request. This is used for IP range access control.
func NewHostedGrafanaACHeaderMiddleware(cfg *setting.Cfg) backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &HostedGrafanaACHeaderMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
			log:         log.New("ip_header_middleware"),
			cfg:         cfg,
		}
	})
}

type HostedGrafanaACHeaderMiddleware struct {
	backend.BaseHandler
	log log.Logger
	cfg *setting.Cfg
}

func (m *HostedGrafanaACHeaderMiddleware) applyGrafanaRequestIDHeader(ctx context.Context, pCtx backend.PluginContext, h backend.ForwardHTTPHeaders) {
	// if request is not for a datasource, skip the middleware
	if h == nil || pCtx.DataSourceInstanceSettings == nil {
		return
	}

	// Check if the request is for a datasource that is allowed to have the header
	dsURL := pCtx.DataSourceInstanceSettings.URL
	dsBaseURL, err := url.Parse(dsURL)
	if err != nil {
		m.log.Debug("Failed to parse data source URL", "error", err)
		return
	}
	if !IsRequestURLInAllowList(dsBaseURL, m.cfg) {
		m.log.Debug("Data source URL not among the allow-listed URLs", "url", dsBaseURL.String())
		return
	}

	var req *http.Request
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx != nil {
		req = reqCtx.Req
	}
	for k, v := range GetGrafanaRequestIDHeaders(req, m.cfg, m.log) {
		h.SetHTTPHeader(k, v)
	}
}

func IsRequestURLInAllowList(url *url.URL, cfg *setting.Cfg) bool {
	for _, allowedURL := range cfg.IPRangeACAllowedURLs {
		// Only look at the scheme and host, ignore the path
		if allowedURL.Host == url.Host && allowedURL.Scheme == url.Scheme {
			return true
		}
	}
	return false
}

func GetGrafanaRequestIDHeaders(req *http.Request, cfg *setting.Cfg, logger log.Logger) map[string]string {
	// Generate a new Grafana request ID and sign it with the secret key
	uid, err := uuid.NewRandom()
	if err != nil {
		logger.Debug("Failed to generate Grafana request ID", "error", err)
		return nil
	}
	grafanaRequestID := uid.String()

	hmac := hmac.New(sha256.New, []byte(cfg.IPRangeACSecretKey))
	if _, err := hmac.Write([]byte(grafanaRequestID)); err != nil {
		logger.Debug("Failed to sign IP range access control header", "error", err)
		return nil
	}
	signedGrafanaRequestID := hex.EncodeToString(hmac.Sum(nil))

	headers := make(map[string]string)
	headers[GrafanaRequestID] = grafanaRequestID
	headers[GrafanaSignedRequestID] = signedGrafanaRequestID

	// If the remote address is not specified, treat the request as internal
	remoteAddress := ""
	if req != nil {
		remoteAddress = web.RemoteAddr(req)
	}
	if remoteAddress != "" {
		headers[XRealIPHeader] = remoteAddress
	} else {
		headers[GrafanaInternalRequest] = "true"
	}

	return headers
}

func (m *HostedGrafanaACHeaderMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	m.applyGrafanaRequestIDHeader(ctx, req.PluginContext, req)

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *HostedGrafanaACHeaderMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	m.applyGrafanaRequestIDHeader(ctx, req.PluginContext, req)

	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *HostedGrafanaACHeaderMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	m.applyGrafanaRequestIDHeader(ctx, req.PluginContext, req)

	return m.BaseHandler.CheckHealth(ctx, req)
}

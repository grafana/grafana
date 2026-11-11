package clientmiddleware

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// decoupledCorePluginIDs are the datasources that used to run inside Grafana, where the
// [dataproxy] timeout options applied to them through the SDK's process-wide defaults.
// Now that they run in their own process, those defaults no longer reach them.
var decoupledCorePluginIDs = map[string]bool{
	"cloudwatch":                   true,
	"elasticsearch":                true,
	"grafana-pyroscope-datasource": true,
	"influxdb":                     true,
	"jaeger":                       true,
	"loki":                         true,
	"opentsdb":                     true,
	"parca":                        true,
	"prometheus":                   true,
	"stackdriver":                  true,
	"tempo":                        true,
	"zipkin":                       true,
}

// NewDataProxyTimeoutMiddleware creates a new backend.HandlerMiddleware that forwards the
// [dataproxy] timeout options that differ from the SDK defaults to decoupled core datasource
// plugins, by setting them in the datasource jsonData that the SDK reads them from.
// Options already set in a datasource's jsonData take precedence.
//
// Deprecated: this only keeps backwards compatibility for datasources that were moved out of
// core and is not a pattern to follow; it may be removed in the next major version of Grafana.
// Timeout options for a datasource should be set in its jsonData.
func NewDataProxyTimeoutMiddleware(configured, sdkDefaults sdkhttpclient.TimeoutOptions) backend.HandlerMiddleware {
	overrides := timeoutJSONDataOverrides(configured, sdkDefaults)
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &DataProxyTimeoutMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
			overrides:   overrides,
		}
	})
}

// DataProxyTimeoutMiddleware is the middleware created by NewDataProxyTimeoutMiddleware.
//
// Deprecated: see NewDataProxyTimeoutMiddleware.
type DataProxyTimeoutMiddleware struct {
	backend.BaseHandler
	overrides map[string]json.RawMessage
}

// timeoutJSONDataOverrides returns, keyed by the jsonData property the SDK reads, the
// configured options that differ from the SDK defaults.
func timeoutJSONDataOverrides(configured, defaults sdkhttpclient.TimeoutOptions) map[string]json.RawMessage {
	overrides := map[string]json.RawMessage{}
	addInt := func(key string, configured, def int) {
		if configured != def {
			overrides[key] = json.RawMessage(strconv.Itoa(configured))
		}
	}
	addDuration := func(key string, configured, def time.Duration) {
		addInt(key, int(configured/time.Second), int(def/time.Second))
	}

	addDuration("timeout", configured.Timeout, defaults.Timeout)
	addDuration("dialTimeout", configured.DialTimeout, defaults.DialTimeout)
	addDuration("httpKeepAlive", configured.KeepAlive, defaults.KeepAlive)
	addDuration("httpTLSHandshakeTimeout", configured.TLSHandshakeTimeout, defaults.TLSHandshakeTimeout)
	addDuration("httpExpectContinueTimeout", configured.ExpectContinueTimeout, defaults.ExpectContinueTimeout)
	addInt("httpMaxConnsPerHost", configured.MaxConnsPerHost, defaults.MaxConnsPerHost)
	addInt("httpMaxIdleConns", configured.MaxIdleConns, defaults.MaxIdleConns)
	addInt("httpMaxIdleConnsPerHost", configured.MaxIdleConnsPerHost, defaults.MaxIdleConnsPerHost)
	addDuration("httpIdleConnTimeout", configured.IdleConnTimeout, defaults.IdleConnTimeout)

	return overrides
}

func (m *DataProxyTimeoutMiddleware) applyTimeouts(pCtx *backend.PluginContext) {
	if len(m.overrides) == 0 || pCtx.DataSourceInstanceSettings == nil || !decoupledCorePluginIDs[pCtx.PluginID] {
		return
	}

	jsonData := map[string]json.RawMessage{}
	if raw := pCtx.DataSourceInstanceSettings.JSONData; len(raw) > 0 {
		if err := json.Unmarshal(raw, &jsonData); err != nil {
			return
		}
		if jsonData == nil { // jsonData was "null"
			jsonData = map[string]json.RawMessage{}
		}
	}

	changed := false
	for key, value := range m.overrides {
		if _, exists := jsonData[key]; !exists {
			jsonData[key] = value
			changed = true
		}
	}
	if !changed {
		return
	}

	b, err := json.Marshal(jsonData)
	if err != nil {
		return
	}

	// Copy the settings rather than modifying them in place, since callers may cache them.
	settings := *pCtx.DataSourceInstanceSettings
	settings.JSONData = b
	pCtx.DataSourceInstanceSettings = &settings
}

func (m *DataProxyTimeoutMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req != nil {
		m.applyTimeouts(&req.PluginContext)
	}
	return m.BaseHandler.QueryData(ctx, req)
}

func (m *DataProxyTimeoutMiddleware) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	if req != nil {
		m.applyTimeouts(&req.PluginContext)
	}
	return m.BaseHandler.QueryChunkedData(ctx, req, w)
}

func (m *DataProxyTimeoutMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req != nil {
		m.applyTimeouts(&req.PluginContext)
	}
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *DataProxyTimeoutMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req != nil {
		m.applyTimeouts(&req.PluginContext)
	}
	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *DataProxyTimeoutMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req != nil {
		m.applyTimeouts(&req.PluginContext)
	}
	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *DataProxyTimeoutMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req != nil {
		m.applyTimeouts(&req.PluginContext)
	}
	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *DataProxyTimeoutMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req != nil {
		m.applyTimeouts(&req.PluginContext)
	}
	return m.BaseHandler.RunStream(ctx, req, sender)
}

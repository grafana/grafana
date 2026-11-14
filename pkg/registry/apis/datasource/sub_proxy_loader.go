package datasource

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	krequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/httpclient"
)

// datasourceLoader adapts a PluginDatasourceProvider into the pluginproxy.DataSourceLoader
// the frontend proxy expects. It keeps the proxy decoupled from the legacy
// DataSourceService: everything is derived from the provider's public methods.
type datasourceLoader struct {
	provider   PluginDatasourceProvider
	uid        string
	pluginType string

	// The datasource and its decrypted settings are immutable for the lifetime
	// of a single proxied request, so cache them to avoid repeated lookups and
	// decryptions (DataSource is read both for validation and inside the proxy).
	datasource         *datasourceV0.DataSource
	settings           *backend.DataSourceInstanceSettings
	transports         *proxyTransportCache
	transportConfigKey string
	defaultTimeout     time.Duration
}

var _ pluginproxy.DataSourceLoader = (*datasourceLoader)(nil)

func newDatasourceLoader(provider PluginDatasourceProvider, uid, pluginType string) *datasourceLoader {
	return &datasourceLoader{provider: provider, uid: uid, pluginType: pluginType}
}

func (l *datasourceLoader) PluginType() string {
	return l.pluginType
}

func (l *datasourceLoader) DataSource(ctx context.Context) (*datasourceV0.DataSource, error) {
	if l.datasource != nil {
		return l.datasource, nil
	}
	ds, err := l.provider.GetDataSource(ctx, l.uid)
	if err != nil {
		return nil, err
	}
	l.datasource = ds
	return ds, nil
}

func (l *datasourceLoader) instanceSettings(ctx context.Context) (*backend.DataSourceInstanceSettings, error) {
	if l.settings != nil {
		return l.settings, nil
	}
	settings, err := l.provider.GetInstanceSettings(ctx, l.uid)
	if err != nil {
		return nil, err
	}
	l.settings = settings
	return settings, nil
}

func (l *datasourceLoader) DecryptedValues(ctx context.Context) (map[string]string, error) {
	settings, err := l.instanceSettings(ctx)
	if err != nil {
		return nil, err
	}
	return settings.DecryptedSecureJSONData, nil
}

func (l *datasourceLoader) DecryptedPassword(ctx context.Context) (string, error) {
	return l.secureValue(ctx, "password")
}

func (l *datasourceLoader) DecryptedBasicAuthPassword(ctx context.Context) (string, error) {
	return l.secureValue(ctx, "basicAuthPassword")
}

func (l *datasourceLoader) secureValue(ctx context.Context, key string) (string, error) {
	values, err := l.DecryptedValues(ctx)
	if err != nil {
		return "", err
	}
	return values[key], nil
}

func (l *datasourceLoader) GetHTTPTransport(ctx context.Context, clientProvider httpclient.Provider) (http.RoundTripper, error) {
	settings, err := l.instanceSettings(ctx)
	if err != nil {
		return nil, err
	}
	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, err
	}
	if opts.Timeouts != nil {
		opts.Timeouts.Timeout = l.responseHeaderTimeout(settings.JSONData)
	}
	// Without a namespace, do not risk sharing connections between tenants.
	namespace := krequest.NamespaceValue(ctx)
	if l.transports == nil || namespace == "" {
		return clientProvider.GetTransport(opts)
	}
	fingerprint, err := proxyTransportFingerprint(settings, opts, l.transportConfigKey)
	if err != nil {
		return nil, err
	}
	key := proxyTransportKey{namespace: namespace, plugin: l.pluginType, uid: l.uid}
	return l.transports.get(key, fingerprint, func() (http.RoundTripper, func(), error) {
		// SDK middleware wrappers do not expose CloseIdleConnections. Capture the
		// underlying transport so eviction can release its connection pool.
		var transport *http.Transport
		opts.ConfigureTransport = func(_ sdkhttpclient.Options, t *http.Transport) { transport = t }
		rt, err := clientProvider.GetTransport(opts)
		closeIdle := func() {
			if transport != nil {
				transport.CloseIdleConnections()
			}
		}
		return rt, closeIdle, err
	})
}

// responseHeaderTimeout prefers the datasource's own timeout, read as the legacy
// proxy reads it. The SDK would otherwise fall back to its process-wide default,
// which is not the tenant's configuration in multi-tenant Grafana.
func (l *datasourceLoader) responseHeaderTimeout(jsonData json.RawMessage) time.Duration {
	var data struct {
		Timeout any `json:"timeout"`
	}
	if err := json.Unmarshal(jsonData, &data); err == nil {
		switch v := data.Timeout.(type) {
		case float64:
			if v > 0 {
				return time.Duration(v) * time.Second
			}
		case string:
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				return time.Duration(n) * time.Second
			}
		}
	}
	if l.defaultTimeout > 0 {
		return l.defaultTimeout
	}
	return defaultProxyTimeout
}

package datasource

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/httpclient"
)

// providerLoader adapts a PluginDatasourceProvider into the pluginproxy.DataSourceLoader
// the frontend proxy expects. It keeps the proxy decoupled from the legacy
// DataSourceService: everything is derived from the provider's public methods.
type providerLoader struct {
	provider   PluginDatasourceProvider
	uid        string
	pluginType string

	// The datasource and its decrypted settings are immutable for the lifetime
	// of a single proxied request, so cache them to avoid repeated lookups and
	// decryptions (DataSource is read both for validation and inside the proxy).
	datasource *datasourceV0.DataSource
	settings   *backend.DataSourceInstanceSettings
}

var _ pluginproxy.DataSourceLoader = (*providerLoader)(nil)

func newProviderLoader(provider PluginDatasourceProvider, uid, pluginType string) *providerLoader {
	return &providerLoader{provider: provider, uid: uid, pluginType: pluginType}
}

func (l *providerLoader) PluginType() string {
	return l.pluginType
}

func (l *providerLoader) DataSource(ctx context.Context) (*datasourceV0.DataSource, error) {
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

func (l *providerLoader) instanceSettings(ctx context.Context) (*backend.DataSourceInstanceSettings, error) {
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

func (l *providerLoader) DecryptedValues(ctx context.Context) (map[string]string, error) {
	settings, err := l.instanceSettings(ctx)
	if err != nil {
		return nil, err
	}
	return settings.DecryptedSecureJSONData, nil
}

func (l *providerLoader) DecryptedPassword(ctx context.Context) (string, error) {
	return l.secureValue(ctx, "password")
}

func (l *providerLoader) DecryptedBasicAuthPassword(ctx context.Context) (string, error) {
	return l.secureValue(ctx, "basicAuthPassword")
}

func (l *providerLoader) secureValue(ctx context.Context, key string) (string, error) {
	values, err := l.DecryptedValues(ctx)
	if err != nil {
		return "", err
	}
	return values[key], nil
}

func (l *providerLoader) GetHTTPTransport(ctx context.Context, clientProvider httpclient.Provider) (http.RoundTripper, error) {
	settings, err := l.instanceSettings(ctx)
	if err != nil {
		return nil, err
	}
	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, err
	}
	return clientProvider.GetTransport(opts)
}

package datasource

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

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
	datasource *datasourceV0.DataSource
	settings   *backend.DataSourceInstanceSettings
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
	return clientProvider.GetTransport(opts)
}

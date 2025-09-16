package writer

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	gocache "github.com/patrickmn/go-cache"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
)

const (
	// We do not need to aggresively refresh data source settings, because a
	// typical recording rule only writes every 60 seconds.
	cacheExpiration = 30 * time.Second

	// Time between cleaning expired data sources.
	cacheCleanupInterval = 10 * time.Minute
)

type backendType string

const (
	grafanaCloudPromType backendType = "grafanacloud-prom"
	prometheusType       backendType = "prometheus"
)

type DatasourceWriterConfig struct {
	// Timeout is the maximum time to wait for a remote write to succeed.
	Timeout time.Duration

	// DetaultDatasourceUID is the data source used if no data source is specified.
	// This exists to cater for upgrading from old versions of Grafana, where rule
	// definitions may not have a target data source specified.
	DefaultDatasourceUID string

	// CustomHeaders is a map of optional custom HTTP headers
	// to include in recording rule write requests.
	CustomHeaders map[string]string
}

type PluginContextProvider interface {
	GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error)
}

type DatasourceWriter struct {
	cfg                   DatasourceWriterConfig
	datasources           datasources.DataSourceService
	httpClientProvider    HttpClientProvider
	pluginContextProvider PluginContextProvider
	clock                 clock.Clock
	l                     log.Logger
	metrics               *metrics.RemoteWriter

	writers *gocache.Cache
}

func NewDatasourceWriter(
	cfg DatasourceWriterConfig,
	datasources datasources.DataSourceService,
	httpClientProvider HttpClientProvider,
	pluginContextProvider PluginContextProvider,
	clock clock.Clock,
	l log.Logger,
	metrics *metrics.RemoteWriter,
) *DatasourceWriter {
	return &DatasourceWriter{
		cfg:                   cfg,
		datasources:           datasources,
		httpClientProvider:    httpClientProvider,
		pluginContextProvider: pluginContextProvider,
		clock:                 clock,
		l:                     l,
		metrics:               metrics,
		writers:               gocache.New(cacheExpiration, cacheCleanupInterval),
	}
}

func (w *DatasourceWriter) decrypt(ds *datasources.DataSource) (map[string]string, error) {
	decryptedJsonData, err := w.datasources.DecryptedValues(context.Background(), ds)
	if err != nil {
		w.l.Error("Failed to decrypt secure json data", "error", err)
	}
	return decryptedJsonData, err
}

func getPrometheusType(ds *datasources.DataSource) string {
	if ds.JsonData == nil {
		return ""
	}
	jsonData := ds.JsonData.Get("prometheusType")
	if jsonData == nil {
		return ""
	}
	str, err := jsonData.String()
	if err != nil {
		return ""
	}
	return str
}

func getRemoteWriteURL(ds *datasources.DataSource) (*url.URL, error) {
	u, err := url.Parse(ds.URL)
	if err != nil {
		return nil, err
	}

	if getPrometheusType(ds) == "Prometheus" {
		return u.JoinPath("/api/v1/write"), nil
	}

	// All other cases assume Mimir/Cortex, as these systems are much more likely to be
	// used as a remote write target, where as Prometheus does not recommend it.

	// Mimir/Cortex are more complicated, as Grafana has to be configured with the
	// base URL for where the Prometheus API is located, e.g. /api/prom or /prometheus.
	//
	// - For "legacy" routes, /push is located on the same level as /api/v1/query.
	//
	//   For example:
	//     Grafana will be configured with <host>/api/prom
	//     The query API is at /api/prom/api/v1/query
	//     The push API is at /api/prom/push
	//
	// - For "new" routes, /push is located at the Mimir root, not Prometheus root.
	//
	//   For example:
	//     Grafana will be configured with e.g. <host>/prometheus
	//     The query API is at /prometheus/api/v1/query
	//     But push API is at /push
	//
	// Unfortunately, the prefixes can also be configured,

	cleanPath := path.Clean(u.Path)

	// If the suffix is /api/prom, assume Mimir/Cortex with legacy routes.
	if strings.HasSuffix(cleanPath, "/api/prom") {
		u.Path = path.Join(u.Path, "/push")
		return u, nil
	}

	// If the suffix is /prometheus, assume Mimir/Cortex with new routes.
	if strings.HasSuffix(cleanPath, "/prometheus") {
		u.Path = path.Join(path.Dir(u.Path), "/api/v1/push")
		return u, nil
	}

	// The user has configured an unknown prefix, so fall back to taking
	// the host as the Mimir root. This is less than ideal.
	u.Path = "/api/v1/push"
	return u, nil
}

func (w *DatasourceWriter) makeWriter(ctx context.Context, orgID int64, dsUID string) (*PrometheusWriter, error) {
	ds, err := w.datasources.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		UID:   dsUID,
		OrgID: orgID,
	})
	if err != nil {
		return nil, err
	}

	if ds.Type != datasources.DS_PROMETHEUS {
		return nil, errors.New("can only write to data sources of type prometheus")
	}

	is, err := adapters.ModelToInstanceSettings(ds, w.decrypt)
	if err != nil {
		return nil, err
	}

	httpClientCtx := ctx
	if w.pluginContextProvider != nil {
		pluginCtx, err := w.pluginContextProvider.GetWithDataSource(ctx, ds.Type, nil, ds)
		if err != nil {
			return nil, fmt.Errorf("failed to get plugin context: %w", err)
		}
		httpClientCtx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	} else {
		// This should not happen, but if the plugin context provider is not set, log a warning.
		w.l.Warn("Plugin context provider is not set for the data source writer, PDC-enabled data sources may not work correctly", "datasource_uid", dsUID, "datasource_type", ds.Type)
	}

	ho, err := is.HTTPClientOptions(httpClientCtx)
	if err != nil {
		return nil, err
	}

	u, err := getRemoteWriteURL(ds)
	if err != nil {
		return nil, err
	}

	headers := make(http.Header)
	for k, v := range w.cfg.CustomHeaders {
		headers.Add(k, v)
	}

	var backend backendType
	if dsUID == string(grafanaCloudPromType) {
		backend = grafanaCloudPromType
	} else {
		backend = prometheusType
	}

	cfg := PrometheusWriterConfig{
		URL: u.String(),
		HTTPOptions: httpclient.Options{
			Timeouts:     ho.Timeouts,
			TLS:          ho.TLS,
			BasicAuth:    ho.BasicAuth,
			Header:       headers,
			ProxyOptions: ho.ProxyOptions,
		},
		Timeout:     w.cfg.Timeout,
		BackendType: backend,
	}
	if err != nil {
		return nil, err
	}

	w.l.Debug("Created Prometheus remote writer",
		"datasource_uid", dsUID,
		"type", ds.Type,
		"prometheusType", getPrometheusType(ds),
		"url", cfg.URL,
		"tls", cfg.HTTPOptions.TLS != nil,
		"basic_auth", cfg.HTTPOptions.BasicAuth != nil,
		"timeout", cfg.Timeout)

	return NewPrometheusWriter(
		cfg,
		w.httpClientProvider,
		w.clock,
		w.l,
		w.metrics)
}

func uidKey(orgID int64, uid string) string {
	return fmt.Sprintf("%d-%s", orgID, uid)
}

func (w *DatasourceWriter) WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error {
	if dsUID == "" {
		if w.cfg.DefaultDatasourceUID == "" {
			return errors.New("data source uid not specified and no default set")
		}
		dsUID = w.cfg.DefaultDatasourceUID
		w.l.Debug("Using default data source for remote write",
			"org_id", orgID, "datasource_uid", dsUID)
	}

	key := uidKey(orgID, dsUID)

	var writer *PrometheusWriter

	val, ok := w.writers.Get(key)
	if ok {
		var ok bool
		writer, ok = val.(*PrometheusWriter)
		if !ok {
			return errors.New("type in cache not a Writer")
		}
	} else {
		var err error
		writer, err = w.makeWriter(ctx, orgID, dsUID)
		if err != nil {
			w.l.Error("Failed to create writer for data source",
				"org_id", orgID, "datasource_uid", dsUID)
			return err
		}

		w.writers.Set(key, writer, 0)
	}

	return writer.Write(ctx, name, t, frames, orgID, extraLabels)
}

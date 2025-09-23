package writer

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	gocache "github.com/patrickmn/go-cache"

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

type DatasourceWriterConfig struct {
	// Timeout is the maximum time to wait for a remote write to succeed.
	Timeout time.Duration

	// DetaultDatasourceUID is the data source used if no data source is specified.
	// This exists to cater for upgrading from old versions of Grafana, where rule
	// definitions may not have a target data source specified.
	DefaultDatasourceUID string

	// RemoteWritePathSuffix is the path suffix for remote write, normally /push.
	RemoteWritePathSuffix string
}

type DatasourceWriter struct {
	cfg                DatasourceWriterConfig
	datasources        datasources.DataSourceService
	httpClientProvider HttpClientProvider
	clock              clock.Clock
	l                  log.Logger
	metrics            *metrics.RemoteWriter

	writers *gocache.Cache
}

func NewDatasourceWriter(
	cfg DatasourceWriterConfig,
	datasources datasources.DataSourceService,
	httpClientProvider HttpClientProvider,
	clock clock.Clock,
	l log.Logger,
	metrics *metrics.RemoteWriter,
) *DatasourceWriter {
	return &DatasourceWriter{
		cfg:                cfg,
		datasources:        datasources,
		httpClientProvider: httpClientProvider,
		clock:              clock,
		l:                  l,
		metrics:            metrics,
		writers:            gocache.New(cacheExpiration, cacheCleanupInterval),
	}
}

func (w *DatasourceWriter) decrypt(ds *datasources.DataSource) (map[string]string, error) {
	decryptedJsonData, err := w.datasources.DecryptedValues(context.Background(), ds)
	if err != nil {
		w.l.Error("Failed to decrypt secure json data", "error", err)
	}
	return decryptedJsonData, err
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

	ho, err := is.HTTPClientOptions(ctx)
	if err != nil {
		return nil, err
	}

	u, err := url.Parse(is.URL)
	if err != nil {
		return nil, err
	}

	u = u.JoinPath(w.cfg.RemoteWritePathSuffix)

	cfg := PrometheusWriterConfig{
		URL: u.String(),
		HTTPOptions: httpclient.Options{
			Timeouts:  ho.Timeouts,
			TLS:       ho.TLS,
			BasicAuth: ho.BasicAuth,
		},
		Timeout: w.cfg.Timeout,
	}
	if err != nil {
		return nil, err
	}

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

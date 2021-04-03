package telemetry

import (
	"context"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"

	"github.com/grafana/grafana-live-sdk/telemetry/telegraf"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("live_push")
)

func init() {
	registry.RegisterServiceWithPriority(&Receiver{}, registry.Low)
}

// Receiver proxies telemetry requests to Grafana Live system.
type Receiver struct {
	Cfg             *setting.Cfg             `inject:""`
	PluginManager   *manager.PluginManager   `inject:""`
	Bus             bus.Bus                  `inject:""`
	CacheService    *localcache.CacheService `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	GrafanaLive     *live.GrafanaLive        `inject:""`

	telegrafConverterWide         *telegraf.Converter
	telegrafConverterLabelsColumn *telegraf.Converter
}

// Init Receiver.
func (t *Receiver) Init() error {
	logger.Info("Telemetry Receiver initialization")

	if !t.IsEnabled() {
		logger.Debug("Telemetry Receiver not enabled, skipping initialization")
		return nil
	}

	// For now only Telegraf converter (influx format) is supported.
	t.telegrafConverterWide = telegraf.NewConverter()
	t.telegrafConverterLabelsColumn = telegraf.NewConverter(telegraf.WithUseLabelsColumn(true))

	factory := coreplugin.New(backend.ServeOpts{
		//	StreamHandler: newTelemetryStreamHandler(t.streams),
	})
	err := t.PluginManager.BackendPluginManager.Register("managed-stream-fake-plugin", factory)
	if err != nil {
		return err
	}
	return nil
}

// Run Receiver.
func (t *Receiver) Run(ctx context.Context) error {
	if !t.IsEnabled() {
		logger.Debug("GrafanaLive feature not enabled, skipping initialization of Telemetry Receiver")
		return nil
	}
	<-ctx.Done()
	return ctx.Err()
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (t *Receiver) IsEnabled() bool {
	return t.Cfg.IsLiveEnabled() // turn on when Live on for now.
}

func (t *Receiver) Handle(ctx *models.ReqContext) {
	slug := ctx.Req.URL.Path
	slug = strings.TrimPrefix(slug, "/api/live/push/")
	if len(slug) < 1 || strings.Contains(slug, "/") {
		logger.Error("invalid slug", "slug", slug)
		ctx.Resp.WriteHeader(http.StatusBadRequest)
		return
	}

	stream, err := t.GrafanaLive.GetManagedStream(slug)
	if err != nil {
		logger.Error("Error getting stram", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	converter := t.telegrafConverterWide
	if ctx.Req.URL.Query().Get("format") == "labels_column" {
		converter = t.telegrafConverterLabelsColumn
	}

	body, err := ctx.Req.Body().Bytes()
	if err != nil {
		logger.Error("Error reading body", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	logger.Debug("Telemetry request body", "path", slug, "body", len(body)) //string(body) )

	metricFrames, err := converter.Convert(body)
	if err != nil {
		logger.Error("Error converting metrics", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	// TODO -- make sure all packets are combined together!
	// interval = "1s" vs flush_interval = "5s"

	for _, mf := range metricFrames {
		err := stream.Push(mf.Key(), mf.Frame())
		if err != nil {
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}
	}
}

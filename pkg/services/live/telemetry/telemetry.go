package telemetry

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana-live-sdk/telemetry/telegraf"
	"github.com/grafana/grafana-plugin-sdk-go/data"

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
	logger = log.New("telemetry")
)

func init() {
	registry.RegisterServiceWithPriority(&LiveProxy{}, registry.Low)
}

// LiveProxy proxies telemetry requests to Grafana Live system.
type LiveProxy struct {
	Cfg             *setting.Cfg             `inject:""`
	PluginManager   *manager.PluginManager   `inject:""`
	Bus             bus.Bus                  `inject:""`
	CacheService    *localcache.CacheService `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	GrafanaLive     *live.GrafanaLive        `inject:""`

	converter *telegraf.Converter
}

// Init LiveProxy.
func (t *LiveProxy) Init() error {
	logger.Info("Telemetry LiveProxy proxy initialization")

	if !t.IsEnabled() {
		logger.Debug("Telemetry LiveProxy feature not enabled, skipping initialization")
		return nil
	}

	t.converter = telegraf.NewConverter()
	return nil
}

// Run LiveProxy.
func (t *LiveProxy) Run(ctx context.Context) error {
	if !t.IsEnabled() {
		logger.Debug("GrafanaLive feature not enabled, skipping initialization")
		return nil
	}
	<-ctx.Done()
	return ctx.Err()
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (t *LiveProxy) IsEnabled() bool {
	return t.Cfg.IsLiveEnabled() // turn on when Live on for now.
}

func (t *LiveProxy) Handle(ctx *models.ReqContext) {
	path := ctx.Req.URL.Path
	path = strings.TrimPrefix(path, "/api/live/telemetry/")

	body, err := ctx.Req.Body().Bytes()
	if err != nil {
		logger.Error("Error reading body", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	logger.Debug("Telemetry request body", "body", string(body), "path", path)

	metricFrames, err := t.converter.Convert(body)
	if err != nil {
		logger.Error("Error converting metrics", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	for _, mf := range metricFrames {
		frameData, err := data.FrameToJSON(mf.Frame(), true, true)
		if err != nil {
			logger.Error("Error marshaling Frame to JSON", "error", err)
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}
		channel := fmt.Sprintf("telemetry/%s/%s", path, mf.Key())
		logger.Debug("publish data to channel", "channel", channel, "data", string(frameData))
		err = t.GrafanaLive.Publish(channel, frameData)
		if err != nil {
			logger.Error("Error publishing to a channel", "error", err, "channel", channel)
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}
	}
}

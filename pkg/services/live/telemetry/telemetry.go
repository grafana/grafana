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

	telegrafConverter *telegraf.Converter
}

// Init Receiver.
func (t *Receiver) Init() error {
	logger.Info("Telemetry Receiver initialization")

	if !t.IsEnabled() {
		logger.Debug("Telemetry Receiver not enabled, skipping initialization")
		return nil
	}

	// For now only Telegraf converter (influx format) is supported.
	t.telegrafConverter = telegraf.NewConverter()
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
	path := ctx.Req.URL.Path
	path = strings.TrimPrefix(path, "/api/live/telemetry/")

	body, err := ctx.Req.Body().Bytes()
	if err != nil {
		logger.Error("Error reading body", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	logger.Debug("Telemetry request body", "body", string(body), "path", path)

	metricFrames, err := t.telegrafConverter.Convert(body)
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
		// TODO: need a proper path validation (but for now pass it as part of channel name).
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

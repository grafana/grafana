package push

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-live-sdk/telemetry/telegraf"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("live_push")
)

func init() {
	registry.RegisterServiceWithPriority(&Gateway{}, registry.Low)
}

// Gateway receives data and translates it to Grafana Live publications.
type Gateway struct {
	Cfg         *setting.Cfg      `inject:""`
	GrafanaLive *live.GrafanaLive `inject:""`

	telegrafConverterWide         *telegraf.Converter
	telegrafConverterLabelsColumn *telegraf.Converter
}

// Init Gateway.
func (g *Gateway) Init() error {
	logger.Info("Telemetry Gateway initialization")

	if !g.IsEnabled() {
		logger.Debug("Telemetry Gateway not enabled, skipping initialization")
		return nil
	}

	// For now only Telegraf converter (influx format) is supported.
	g.telegrafConverterWide = telegraf.NewConverter()
	g.telegrafConverterLabelsColumn = telegraf.NewConverter(telegraf.WithUseLabelsColumn(true))
	return nil
}

// Run Gateway.
func (g *Gateway) Run(ctx context.Context) error {
	if !g.IsEnabled() {
		logger.Debug("GrafanaLive feature not enabled, skipping initialization of Telemetry Gateway")
		return nil
	}
	<-ctx.Done()
	return ctx.Err()
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (g *Gateway) IsEnabled() bool {
	return g.Cfg.IsLiveEnabled() // turn on when Live on for now.
}

func (g *Gateway) Handle(ctx *models.ReqContext) {
	streamID := ctx.Params(":streamId")

	stream, err := g.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(streamID)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	// TODO Grafana 8: decide which format to use or keep both.
	converter := g.telegrafConverterWide
	if ctx.Req.URL.Query().Get("format") == "labels_column" {
		converter = g.telegrafConverterLabelsColumn
	}

	body, err := ctx.Req.Body().Bytes()
	if err != nil {
		logger.Error("Error reading body", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	logger.Debug("Live Push request body", "streamId", streamID, "bodyLength", len(body))

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

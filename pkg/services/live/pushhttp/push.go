package pushhttp

import (
	"context"
	"errors"
	"io"
	"net/http"

	liveDto "github.com/grafana/grafana-plugin-sdk-go/live"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/pushurl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var (
	logger = log.New("live.push_http")
)

func ProvideService(cfg *setting.Cfg, live *live.GrafanaLive) *Gateway {
	logger.Info("Live Push Gateway initialization")
	g := &Gateway{
		Cfg:         cfg,
		GrafanaLive: live,
		converter:   convert.NewConverter(),
	}
	return g
}

// Gateway receives data and translates it to Grafana Live publications.
type Gateway struct {
	Cfg         *setting.Cfg
	GrafanaLive *live.GrafanaLive

	converter *convert.Converter
}

// Run Gateway.
func (g *Gateway) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (g *Gateway) Handle(ctx *contextmodel.ReqContext) {
	streamID := web.Params(ctx.Req)[":streamId"]

	stream, err := g.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(ctx.OrgID, liveDto.ScopeStream, streamID)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	// TODO Grafana 8: decide which formats to use or keep all.
	urlValues := ctx.Req.URL.Query()
	frameFormat := pushurl.FrameFormatFromValues(urlValues)

	body, err := io.ReadAll(ctx.Req.Body)
	if err != nil {
		logger.Error("Error reading body", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	logger.Debug("Live Push request",
		"protocol", "http",
		"streamId", streamID,
		"bodyLength", len(body),
		"frameFormat", frameFormat,
	)

	metricFrames, err := g.converter.Convert(body, frameFormat)
	if err != nil {
		logger.Error("Error converting metrics", "error", err, "frameFormat", frameFormat)
		if errors.Is(err, convert.ErrUnsupportedFrameFormat) {
			ctx.Resp.WriteHeader(http.StatusBadRequest)
		} else {
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
		}
		return
	}

	// TODO -- make sure all packets are combined together!
	// interval = "1s" vs flush_interval = "5s"

	for _, mf := range metricFrames {
		err := stream.Push(ctx.Req.Context(), mf.Key(), mf.Frame())
		if err != nil {
			logger.Error("Error pushing frame", "error", err, "data", string(body))
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}
	}

	ctx.Resp.WriteHeader(http.StatusOK)
}

func (g *Gateway) HandlePipelinePush(ctx *contextmodel.ReqContext) {
	channelID := web.Params(ctx.Req)["*"]

	body, err := io.ReadAll(ctx.Req.Body)
	if err != nil {
		logger.Error("Error reading body", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	logger.Debug("Live channel push request",
		"protocol", "http",
		"channel", channelID,
		"bodyLength", len(body),
	)

	ruleFound, err := g.GrafanaLive.Pipeline.ProcessInput(ctx.Req.Context(), ctx.OrgID, channelID, body)
	if err != nil {
		logger.Error("Pipeline input processing error", "error", err, "body", string(body))
		if errors.Is(err, liveDto.ErrInvalidChannelID) {
			ctx.Resp.WriteHeader(http.StatusBadRequest)
		} else {
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
		}
		return
	}
	if !ruleFound {
		logger.Error("No conversion rule for a channel", "error", err, "channel", channelID)
		ctx.Resp.WriteHeader(http.StatusNotFound)
		return
	}

	ctx.Resp.WriteHeader(http.StatusOK)
}

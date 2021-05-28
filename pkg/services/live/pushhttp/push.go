package pushhttp

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/pushurl"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("live.push_http")
)

func init() {
	registry.RegisterServiceWithPriority(&Gateway{}, registry.Low)
}

// Gateway receives data and translates it to Grafana Live publications.
type Gateway struct {
	Cfg         *setting.Cfg      `inject:""`
	GrafanaLive *live.GrafanaLive `inject:""`

	converter *convert.Converter
}

// Init Gateway.
func (g *Gateway) Init() error {
	logger.Info("Live Push Gateway initialization")

	g.converter = convert.NewConverter()
	return nil
}

// Run Gateway.
func (g *Gateway) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (g *Gateway) Handle(ctx *models.ReqContext) {
	streamID := ctx.Params(":streamId")

	stream, err := g.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(ctx.SignedInUser.OrgId, streamID)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	// TODO Grafana 8: decide which formats to use or keep all.
	urlValues := ctx.Req.URL.Query()
	frameFormat := pushurl.FrameFormatFromValues(urlValues)

	body, err := ctx.Req.Body().Bytes()
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
		err := stream.Push(ctx.SignedInUser.OrgId, mf.Key(), mf.Frame())
		if err != nil {
			ctx.Resp.WriteHeader(http.StatusInternalServerError)
			return
		}
	}
}

package testdatasource

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
)

type testStreamHandler struct {
	logger log.Logger
}

func newTestStreamHandler(logger log.Logger) *testStreamHandler {
	return &testStreamHandler{
		logger: logger,
	}
}

func (p *testStreamHandler) CanSubscribeToStream(_ context.Context, req *backend.SubscribeToStreamRequest) (*backend.SubscribeToStreamResponse, error) {
	p.logger.Debug("Allowing access to stream", "path", req.Path, "user", req.PluginContext.User)
	return &backend.SubscribeToStreamResponse{OK: true}, nil
}

func (p *testStreamHandler) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
	p.logger.Debug("New stream call", "path", request.Path)
	var conf testStreamConfig
	switch request.Path {
	case "random-2s-stream":
		conf = testStreamConfig{
			Interval: 200 * time.Millisecond,
		}
	case "random-flakey-stream":
		conf = testStreamConfig{
			Interval: 200 * time.Millisecond,
			Drop:     0.6,
		}
	case "random-20Hz-stream":
		conf = testStreamConfig{
			Interval: 50 * time.Millisecond,
		}
	default:
		return fmt.Errorf("testdata plugin does not support path: %s", request.Path)
	}
	return p.runTestStream(ctx, request.Path, conf, sender)
}

type testStreamConfig struct {
	Interval time.Duration
	Drop     float64
}

func (p *testStreamHandler) runTestStream(ctx context.Context, path string, conf testStreamConfig, sender backend.StreamPacketSender) error {
	spread := 50.0
	walker := rand.Float64() * 100

	ticker := time.NewTicker(conf.Interval)
	defer ticker.Stop()

	frame := data.NewFrame("testdata",
		data.NewField("Time", nil, make([]time.Time, 1)),
		data.NewField("Value", nil, make([]float64, 1)),
		data.NewField("Min", nil, make([]float64, 1)),
		data.NewField("Max", nil, make([]float64, 1)),
	)

	for {
		select {
		case <-ctx.Done():
			p.logger.Debug("Stop streaming data for path", "path", path)
			return ctx.Err()
		case t := <-ticker.C:
			if rand.Float64() < conf.Drop {
				continue
			}
			delta := rand.Float64() - 0.5
			walker += delta

			frame.Fields[0].Set(0, t)
			frame.Fields[1].Set(0, walker)                                // Value
			frame.Fields[2].Set(0, walker-((rand.Float64()*spread)+0.01)) // Min
			frame.Fields[3].Set(0, walker+((rand.Float64()*spread)+0.01)) // Max

			bytes, err := jsoniter.Marshal(frame) // schema + points
			if err != nil {
				logger.Warn("unable to marshal line", "error", err)
				continue
			}

			packet := &backend.StreamPacket{
				Payload: bytes,
			}
			if err := sender.Send(packet); err != nil {
				return err
			}
		}
	}
}

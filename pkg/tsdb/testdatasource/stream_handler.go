package testdatasource

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
			Drop:     0,
		}
	case "random-flakey-stream":
		conf = testStreamConfig{
			Interval: 200 * time.Millisecond,
			Drop:     0.6,
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

	measurement := models.Measurement{
		Name:   "testdata",
		Time:   0,
		Values: make(map[string]interface{}, 5),
	}
	msg := models.MeasurementBatch{
		Measurements: []models.Measurement{measurement}, // always a single measurement
	}

	for {
		select {
		case <-ctx.Done():
			p.logger.Debug("Stop streaming data for path", "path", path)
			return ctx.Err()
		case <-ticker.C:
			if rand.Float64() < conf.Drop {
				continue
			}
			delta := rand.Float64() - 0.5
			walker += delta

			measurement.Time = time.Now().UnixNano() / int64(time.Millisecond)
			measurement.Values["value"] = walker
			measurement.Values["min"] = walker - ((rand.Float64() * spread) + 0.01)
			measurement.Values["max"] = walker + ((rand.Float64() * spread) + 0.01)

			bytes, err := json.Marshal(&msg)
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

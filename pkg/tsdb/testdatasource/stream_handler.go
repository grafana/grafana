package testdatasource

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
)

type testStreamHandler struct {
	logger log.Logger
	frame  *data.Frame
}

func newTestStreamHandler(logger log.Logger) *testStreamHandler {
	frame := data.NewFrame("testdata",
		data.NewField("Time", nil, make([]time.Time, 1)),
		data.NewField("Value", nil, make([]float64, 1)),
		data.NewField("Min", nil, make([]float64, 1)),
		data.NewField("Max", nil, make([]float64, 1)),
	)
	return &testStreamHandler{
		frame:  frame,
		logger: logger,
	}
}

func (p *testStreamHandler) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	p.logger.Debug("Allowing access to stream", "path", req.Path, "user", req.PluginContext.User)
	initialData, err := backend.NewInitialFrame(p.frame, data.IncludeSchemaOnly)
	if err != nil {
		return nil, err
	}

	// For flight simulations, send the more complex schema
	if strings.HasPrefix(req.Path, "flight") {
		ff := newFlightConfig().initFields()
		initialData, err = backend.NewInitialFrame(ff.frame, data.IncludeSchemaOnly)
		if err != nil {
			return nil, err
		}
	}

	return &backend.SubscribeStreamResponse{
		Status:      backend.SubscribeStreamStatusOK,
		InitialData: initialData,
	}, nil
}

func (p *testStreamHandler) PublishStream(_ context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	p.logger.Debug("Attempt to publish into stream", "path", req.Path, "user", req.PluginContext.User)
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (p *testStreamHandler) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error {
	p.logger.Debug("New stream call", "path", request.Path)
	var conf testStreamConfig
	switch request.Path {
	case "random-2s-stream":
		conf = testStreamConfig{
			Interval: 2 * time.Second,
		}
	case "random-flakey-stream":
		conf = testStreamConfig{
			Interval: 100 * time.Millisecond,
			Drop:     0.75, // keep 25%
		}
	case "random-20Hz-stream":
		conf = testStreamConfig{
			Interval: 50 * time.Millisecond,
		}
	case "flight-5hz-stream":
		conf = testStreamConfig{
			Interval: 200 * time.Millisecond,
			Flight:   newFlightConfig(),
		}
	default:
		return fmt.Errorf("testdata plugin does not support path: %s", request.Path)
	}
	return p.runTestStream(ctx, request.Path, conf, sender)
}

type testStreamConfig struct {
	Interval time.Duration
	Drop     float64
	Flight   *flightConfig
}

func (p *testStreamHandler) runTestStream(ctx context.Context, path string, conf testStreamConfig, sender *backend.StreamSender) error {
	spread := 50.0
	walker := rand.Float64() * 100

	ticker := time.NewTicker(conf.Interval)
	defer ticker.Stop()

	var flight *flightFields
	if conf.Flight != nil {
		flight = conf.Flight.initFields()
		flight.append(conf.Flight.getNextPoint(time.Now()))
	}

	for {
		select {
		case <-ctx.Done():
			p.logger.Debug("Stop streaming data for path", "path", path)
			return ctx.Err()
		case t := <-ticker.C:
			if rand.Float64() < conf.Drop {
				continue
			}

			if flight != nil {
				flight.set(0, conf.Flight.getNextPoint(t))
				if err := sender.SendFrame(flight.frame, data.IncludeDataOnly); err != nil {
					return err
				}
			} else {
				delta := rand.Float64() - 0.5
				walker += delta

				p.frame.Fields[0].Set(0, t)
				p.frame.Fields[1].Set(0, walker)                                // Value
				p.frame.Fields[2].Set(0, walker-((rand.Float64()*spread)+0.01)) // Min
				p.frame.Fields[3].Set(0, walker+((rand.Float64()*spread)+0.01)) // Max
				if err := sender.SendFrame(p.frame, data.IncludeDataOnly); err != nil {
					return err
				}
			}
		}
	}
}

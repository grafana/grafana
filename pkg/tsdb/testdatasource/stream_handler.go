package testdatasource

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func (s *Service) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	s.logger.Debug("Allowing access to stream", "path", req.Path, "user", req.PluginContext.User)
	initialData, err := backend.NewInitialFrame(s.frame, data.IncludeSchemaOnly)
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

	if s.cfg.FeatureToggles["live-pipeline"] {
		// While developing Live pipeline avoid sending initial data.
		initialData = nil
	}

	return &backend.SubscribeStreamResponse{
		Status:      backend.SubscribeStreamStatusOK,
		InitialData: initialData,
	}, nil
}

func (s *Service) PublishStream(_ context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	s.logger.Debug("Attempt to publish into stream", "path", req.Path, "user", req.PluginContext.User)
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (s *Service) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error {
	s.logger.Debug("New stream call", "path", request.Path)
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
	return s.runTestStream(ctx, request.Path, conf, sender)
}

type testStreamConfig struct {
	Interval time.Duration
	Drop     float64
	Flight   *flightConfig
}

func (s *Service) runTestStream(ctx context.Context, path string, conf testStreamConfig, sender *backend.StreamSender) error {
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
			s.logger.Debug("Stop streaming data for path", "path", path)
			return ctx.Err()
		case t := <-ticker.C:
			if rand.Float64() < conf.Drop {
				continue
			}

			mode := data.IncludeDataOnly
			if s.cfg.FeatureToggles["live-pipeline"] {
				mode = data.IncludeAll
			}

			if flight != nil {
				flight.set(0, conf.Flight.getNextPoint(t))
				if err := sender.SendFrame(flight.frame, mode); err != nil {
					return err
				}
			} else {
				delta := rand.Float64() - 0.5
				walker += delta

				s.frame.Fields[0].Set(0, t)
				s.frame.Fields[1].Set(0, walker)                                // Value
				s.frame.Fields[2].Set(0, walker-((rand.Float64()*spread)+0.01)) // Min
				s.frame.Fields[3].Set(0, walker+((rand.Float64()*spread)+0.01)) // Max
				if err := sender.SendFrame(s.frame, mode); err != nil {
					return err
				}
			}
		}
	}
}

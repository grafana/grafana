package testdatasource

import (
	"context"
	"fmt"
	"math/rand"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var random20HzStreamRegex = regexp.MustCompile(`random-20Hz-stream(-\d+)?`)

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	s.logger.Debug("Allowing access to stream", "path", req.Path, "user", req.PluginContext.User)

	if strings.HasPrefix(req.Path, "sim/") {
		return s.sims.SubscribeStream(ctx, req)
	}

	initialData, err := backend.NewInitialFrame(s.frame, data.IncludeSchemaOnly)
	if err != nil {
		return nil, err
	}

	if strings.Contains(req.Path, "-labeled") {
		initialData, err = backend.NewInitialFrame(s.labelFrame, data.IncludeSchemaOnly)
		if err != nil {
			return nil, err
		}
	}

	return &backend.SubscribeStreamResponse{
		Status:      backend.SubscribeStreamStatusOK,
		InitialData: initialData,
	}, nil
}

func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	s.logger.Debug("Attempt to publish into stream", "path", req.Path, "user", req.PluginContext.User)

	if strings.HasPrefix(req.Path, "sim/") {
		return s.sims.PublishStream(ctx, req)
	}

	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (s *Service) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error {
	s.logger.Debug("New stream call", "path", request.Path)

	if strings.HasPrefix(request.Path, "sim/") {
		return s.sims.RunStream(ctx, request, sender)
	}

	var conf testStreamConfig
	switch {
	case request.Path == "random-2s-stream":
		conf = testStreamConfig{
			Interval: 2 * time.Second,
		}
	case request.Path == "random-flakey-stream":
		conf = testStreamConfig{
			Interval: 100 * time.Millisecond,
			Drop:     0.75, // keep 25%
		}
	case request.Path == "random-labeled-stream":
		conf = testStreamConfig{
			Interval: 200 * time.Millisecond,
			Drop:     0.2, // keep 80%
			Labeled:  true,
		}
	case random20HzStreamRegex.MatchString(request.Path):
		conf = testStreamConfig{
			Interval: 50 * time.Millisecond,
		}
	default:
		return fmt.Errorf("testdata plugin does not support path: %s", request.Path)
	}
	return s.runTestStream(ctx, request.Path, conf, sender)
}

type testStreamConfig struct {
	Interval time.Duration
	Drop     float64
	Labeled  bool
}

func (s *Service) runTestStream(ctx context.Context, path string, conf testStreamConfig, sender *backend.StreamSender) error {
	spread := 50.0
	walker := rand.Float64() * 100

	ticker := time.NewTicker(conf.Interval)
	defer ticker.Stop()

	labelFrame := data.NewFrame("labeled",
		data.NewField("labels", nil, make([]string, 2)),
		data.NewField("Time", nil, make([]time.Time, 2)),
		data.NewField("Value", nil, make([]float64, 2)),
	)

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
			delta := rand.Float64() - 0.5
			walker += delta

			if conf.Labeled {
				secA := t.Second() / 3
				secB := t.Second() / 7

				labelFrame.Fields[0].Set(0, fmt.Sprintf("s=A,s=p%d,x=X", secA))
				labelFrame.Fields[1].Set(0, t)
				labelFrame.Fields[2].Set(0, walker)

				labelFrame.Fields[0].Set(1, fmt.Sprintf("s=B,s=p%d,x=X", secB))
				labelFrame.Fields[1].Set(1, t)
				labelFrame.Fields[2].Set(1, walker+10)
				if err := sender.SendFrame(labelFrame, mode); err != nil {
					return err
				}
			} else {
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

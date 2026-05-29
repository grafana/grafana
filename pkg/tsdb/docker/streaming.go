package docker

import (
	"context"
	"fmt"
	"encoding/json"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

)

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, err
	}

	if !strings.HasPrefix(req.Path, "stats/") { 
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("expected tail in channel path")
	}

	query, err := parseQueryRaw(req.Data)
	if err != nil {
		return nil, err
	}
	if query.ContainerID == "" {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("missing expr in channel (subscribe)")
	}

	dsInfo.streamsMu.RLock()
	defer dsInfo.streamsMu.RUnlock()

	cache, ok := dsInfo.streams[req.Path]
	if ok {
		msg, err := backend.NewInitialData(cache.Bytes(data.IncludeAll))
		return &backend.SubscribeStreamResponse{
			Status:      backend.SubscribeStreamStatusOK,
			InitialData: msg,
		}, err
	}

	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}, nil
}


func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	query, err := parseQueryRaw(req.Data)
	if err != nil {
		return err
	}
	if query.ContainerID == "" {
		return fmt.Errorf("missing containerId in channel")
	}

	logger := s.logger.FromContext(ctx)

	stream, err := dsInfo.API.StreamContainerStats(ctx, query.ContainerID)
	if err != nil {
		logger.Error("Error connecting to websocket", "err", err)
		return fmt.Errorf("error connecting to websocket")
	}
	defer func() {
        dsInfo.streamsMu.Lock()
        delete(dsInfo.streams, req.Path)
        dsInfo.streamsMu.Unlock()
        if cerr := stream.Close(); cerr != nil {
            logger.Warn("Failed to close stream", "error", cerr)
        }
    }()
	
	decoder := json.NewDecoder(stream)
	prev := data.FrameJSONCache{}

	for {
		select {
        case <-ctx.Done():
            logger.Info("Stop streaming (context canceled)")
            return nil
        default:
        }
		var sample ContainerStats
		err := decoder.Decode(&sample);
        if err != nil {
            if ctx.Err() != nil {
                return nil
            }
            logger.Error("Failed to decode stats sample", "error", err)
            return err
        }
		frame, err := convertContainerStats(&sample)
        if err != nil {
            logger.Error("Failed to build frame", "error", err)
            continue
        }

        next, _ := data.FrameToJSONCache(frame)
        if next.SameSchema(&prev) { // when schema unchanged
            err = sender.SendBytes(next.Bytes(data.IncludeDataOnly))
        } else {
            err = sender.SendFrame(frame, data.IncludeAll)
        }
        if err != nil {
            logger.Error("Failed to send frame", "error", err)
            return err
        }
        prev = next

        dsInfo.streamsMu.Lock()
        dsInfo.streams[req.Path] = prev
        dsInfo.streamsMu.Unlock()
    }
}



func (s *Service) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

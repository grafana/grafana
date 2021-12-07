package loki

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cuelang.org/go/pkg/strings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

// HACK: temporary -- will break HA until we pass query over subscription
type tailQueryCache struct {
	cache map[string]lokiQuery
	lock  *sync.Mutex
}

// Called from the query method
func (s *Service) registerTailQuery(dsInfo *datasourceInfo, q *lokiQuery) *data.Frame {
	dsInfo.tail.lock.Lock()
	defer dsInfo.tail.lock.Unlock()
	dsInfo.tail.cache[q.TailChannel] = *q

	frame := newLogsFrame(0).frame
	frame.SetMeta(&data.FrameMeta{
		Channel: fmt.Sprintf("%s/%s/tail/%s", live.ScopeDatasource, dsInfo.uid, q.TailChannel),
	})
	return frame
}

func (s *Service) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, err
	}

	key := req.Path[strings.LastIndex(req.Path, "/"):]
	dsInfo.tail.lock.Lock()
	q, ok := dsInfo.tail.cache[key]
	dsInfo.tail.lock.Unlock()

	if !ok || q.TailChannel != "" {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, nil
	}

	// TODO: backfill query
	initial, err := backend.NewInitialFrame(newLogsFrame(0).frame, data.IncludeAll)

	// nothing yet
	return &backend.SubscribeStreamResponse{
		Status:      backend.SubscribeStreamStatusOK,
		InitialData: initial,
	}, err
}

// Single instance for each channel (results are shared with all listeners)
func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return err
	}

	key := req.Path[strings.LastIndex(req.Path, "/"):]
	dsInfo.tail.lock.Lock()
	q, ok := dsInfo.tail.cache[key]
	dsInfo.tail.lock.Unlock()

	if !ok || q.TailChannel == "" {
		return fmt.Errorf("unknown stream: %s", key)
	}

	count := int64(0)

	// Send the first frame
	frame := newLogsFrame(1)
	frame.labels.SetConcrete(0, "a=AAA")
	frame.time.SetConcrete(0, time.Now())
	frame.line.SetConcrete(0, fmt.Sprintf("todo!!! %d", count))
	err = sender.SendFrame(frame.frame, data.IncludeAll)
	if err != nil {
		return err
	}

	ticker := time.NewTicker(q.Step)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			backend.Logger.Info("stop streaming (context canceled)")
			return nil
		case t := <-ticker.C:
			count++
			frame.time.SetConcrete(0, t)
			frame.line.SetConcrete(0, fmt.Sprintf("todo!!! %d", count))
			err = sender.SendFrame(frame.frame, data.IncludeDataOnly)
			if err != nil {
				return err
			}
		}
	}
}

func (s *Service) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

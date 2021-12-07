package loki

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"time"

	"cuelang.org/go/pkg/strings"
	"github.com/gorilla/websocket"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

// HACK: temporary -- will break HA until we pass query over subscription
// We are working to pass the query along with the subscription -- so the query so this cache will not be required
type tailQueryCache struct {
	cache map[string]lokiQuery
	lock  sync.Mutex
}

// Called from the query method
func (s *Service) registerTailQuery(dsInfo *datasourceInfo, q *lokiQuery) *data.Frame {
	dsInfo.tail.lock.Lock()
	defer dsInfo.tail.lock.Unlock()
	dsInfo.tail.cache[q.StreamKey] = *q

	frame := newLogsFrame(0).frame
	frame.SetMeta(&data.FrameMeta{
		Channel: fmt.Sprintf("%s/%s/tail/%s", live.ScopeDatasource, dsInfo.uid, q.StreamKey),
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

	key := req.Path[strings.LastIndex(req.Path, "/")+1:]
	dsInfo.tail.lock.Lock()
	q, ok := dsInfo.tail.cache[key]
	dsInfo.tail.lock.Unlock()

	if !ok || q.StreamKey == "" {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, nil
	}

	// TODO: backfill query???
	// initial, err := backend.NewInitialFrame(newLogsFrame(0).frame, data.IncludeAll)

	// nothing yet
	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}, err
}

// Single instance for each channel (results are shared with all listeners)
func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return err
	}

	key := req.Path[strings.LastIndex(req.Path, "/")+1:]
	dsInfo.tail.lock.Lock()
	q, ok := dsInfo.tail.cache[key]
	dsInfo.tail.lock.Unlock()

	if !ok || q.StreamKey == "" {
		return fmt.Errorf("unknown stream: %s", key)
	}

	count := int64(0)

	// Send the first frame
	frame := newLogsFrame(1)
	frame.labels.SetConcrete(0, "a=AAA")
	frame.time.SetConcrete(0, time.Now())
	frame.line.SetConcrete(0, fmt.Sprintf("initial data: %s", key))
	err = sender.SendFrame(frame.frame, data.IncludeAll)
	if err != nil {
		return err
	}

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	params := url.Values{}
	params.Add("query", q.Expr)

	wsurl, _ := url.Parse(dsInfo.URL)
	if wsurl.Scheme == "https" {
		wsurl.Scheme = "wss"
	} else {
		wsurl.Scheme = "ws"
	}
	wsurl.Path = "/loki/api/v1/tail"
	wsurl.RawQuery = params.Encode()
	// limit, start

	s.plog.Info("connecting to websocket", "url", wsurl)
	c, _, err := websocket.DefaultDialer.Dial(wsurl.String(), nil)
	if err != nil {
		s.plog.Error("error connecting to websocket", err)
		return fmt.Errorf("error connecting to websocket")
	}
	defer c.Close()

	// Read all messages
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				s.plog.Error("websocket read:", err)
				return
			}
			err = sender.SendBytes(message)
			if err != nil {
				s.plog.Error("websocket write:", err)
				return
			}
		}
	}()

	ticker := time.NewTicker(time.Second * 30) //.Step)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			s.plog.Info("socket done")
			return nil
		case <-ctx.Done():
			s.plog.Info("stop streaming (context canceled)")
			return nil
		case t := <-ticker.C:
			count++
			s.plog.Error("websocket ping? %v / %d", t, count)
		}
	}
}

func (s *Service) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func (s *Service) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, err
	}

	// Expect tail/${key}
	if !strings.HasPrefix(req.Path, "tail/") {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("expected tail in channel path")
	}

	query, err := parseQueryModel(req.Data)
	if err != nil {
		return nil, err
	}
	if query.Expr == "" {
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

	query, err := parseQueryModel(req.Data)
	if err != nil {
		return err
	}
	if query.Expr == "" {
		return fmt.Errorf("missing expr in cuannel")
	}

	count := int64(0)

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	params := url.Values{}
	params.Add("query", query.Expr)

	isV1 := false
	wsurl, _ := url.Parse(dsInfo.URL)

	// Check if the v2alpha endpoint exists
	wsurl.Path = "/loki/api/v2alpha/tail"
	if !is400(dsInfo.HTTPClient, wsurl) {
		isV1 = true
		wsurl.Path = "/loki/api/v1/tail"
	}

	if wsurl.Scheme == "https" {
		wsurl.Scheme = "wss"
	} else {
		wsurl.Scheme = "ws"
	}
	wsurl.RawQuery = params.Encode()

	s.plog.Info("connecting to websocket", "url", wsurl)
	c, r, err := websocket.DefaultDialer.Dial(wsurl.String(), nil)
	if err != nil {
		s.plog.Error("error connecting to websocket", "err", err)
		return fmt.Errorf("error connecting to websocket")
	}

	defer func() {
		dsInfo.streamsMu.Lock()
		delete(dsInfo.streams, req.Path)
		dsInfo.streamsMu.Unlock()
		if r != nil {
			_ = r.Body.Close()
		}
		err = c.Close()
		s.plog.Error("closing loki websocket", "err", err)
	}()

	prev := data.FrameJSONCache{}

	// Read all messages
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				s.plog.Error("websocket read:", "err", err)
				return
			}

			frame := &data.Frame{}
			if isV1 {
				frame, err = lokiBytesToLabeledFrame(message)
			} else {
				err = json.Unmarshal(message, &frame)
			}

			if err == nil && frame != nil {
				next, _ := data.FrameToJSONCache(frame)
				if next.SameSchema(&prev) {
					err = sender.SendBytes(next.Bytes(data.IncludeDataOnly))
				} else {
					err = sender.SendFrame(frame, data.IncludeAll)
				}
				prev = next

				// Cache the initial data
				dsInfo.streamsMu.Lock()
				dsInfo.streams[req.Path] = prev
				dsInfo.streamsMu.Unlock()
			}

			if err != nil {
				s.plog.Error("websocket write:", "err", err, "raw", message)
				return
			}
		}
	}()

	ticker := time.NewTicker(time.Second * 60) //.Step)
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
			s.plog.Error("loki websocket ping?", "time", t, "count", count)
		}
	}
}

func (s *Service) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

// if the v2 endpoint exists it will give a 400 rather than 404/500
func is400(client *http.Client, url *url.URL) bool {
	req, err := http.NewRequest("GET", url.String(), nil)
	if err != nil {
		return false
	}
	rsp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer func() {
		_ = rsp.Body.Close()
	}()
	return rsp.StatusCode == 400 // will be true
}

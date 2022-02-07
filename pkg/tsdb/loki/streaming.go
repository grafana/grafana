package loki

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"time"

	"cuelang.org/go/pkg/strings"
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
	if query.Expr == "" {
		return &backend.SubscribeStreamResponse{
			Status: backend.SubscribeStreamStatusNotFound,
		}, fmt.Errorf("missing expr in channel (subscribe)")
	}

	s.plog.Info("TODO: backfill query", "query", query.Expr, "ds", dsInfo.URL)

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
		if r != nil {
			_ = r.Body.Close()
		}
		err = c.Close()
		s.plog.Error("error closing loki websocket", "err", err)
	}()

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
			if isV1 {
				// fmt.Printf("\n\n%s\n", string(message))
				var f *data.Frame
				f, err = lokiBytesToLabeledFrame(message)
				if err == nil {
					err = sender.SendFrame(f, data.IncludeAll)
				}
			} else {
				err = sender.SendBytes(message)
			}
			if err != nil {
				s.plog.Error("websocket write:", "err", err)
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

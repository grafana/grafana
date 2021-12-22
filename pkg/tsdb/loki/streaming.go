package loki

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/signal"
	"time"

	"cuelang.org/go/pkg/strings"
	"github.com/gorilla/websocket"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
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

	s.plog.Info("TODO: backfill query", "query", query, "ds", dsInfo)

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

	wsurl, _ := url.Parse(dsInfo.URL)
	if wsurl.Scheme == "https" {
		wsurl.Scheme = "wss"
	} else {
		wsurl.Scheme = "ws"
	}
	wsurl.Path = "/loki/api/v2alpha/tail"
	wsurl.RawQuery = params.Encode()
	// limit, start

	s.plog.Info("connecting to websocket", "url", wsurl)
	c, _, err := websocket.DefaultDialer.Dial(wsurl.String(), nil)
	if err != nil {
		s.plog.Error("error connecting to websocket", "err", err)
		return fmt.Errorf("error connecting to websocket")
	}

	defer func() {
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
			err = sender.SendBytes(message)
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

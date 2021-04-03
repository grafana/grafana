package live

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/util"
)

// ManagedStream holds the state of a managed stream
type ManagedStream struct {
	mu      sync.RWMutex
	start   time.Time
	last    time.Time
	slug    string
	schemas map[string]json.RawMessage
}

type PushResult struct {
	Frame         *data.Frame
	SchemaChanged bool
	Channel       string
}

// NewCache creates new Cache.
func NewManagedStream(id string) *ManagedStream {
	return &ManagedStream{
		slug:    id,
		start:   time.Now(),
		last:    time.Now(),
		schemas: map[string]json.RawMessage{},
	}
}

// GetInfo returns info for the UI about this stream
func (s *ManagedStream) ListChannels(prefix string) []util.DynMap {
	s.mu.RLock()
	defer s.mu.RUnlock()

	info := make([]util.DynMap, 0, len(s.schemas))
	for k, v := range s.schemas {
		ch := util.DynMap{}
		ch["channel"] = prefix + k
		ch["data"] = v
		info = append(info, ch)
	}
	return info
}

// Push send data to the stream and optionally process it
func (s *ManagedStream) Push(path string, frame *data.Frame) (PushResult, error) {
	res := PushResult{
		Frame: frame, // for now it is the same frame, but it may need to fix order, join, apply field config, etc
	}

	schema, err := data.FrameToJSON(frame, true, false)
	if err != nil {
		logger.Error("Error marshaling Frame to Schema", "error", err)
		return res, err
	}

	existing, ok := s.GetSchema(path)
	if !ok || !bytes.Equal(schema, existing) {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.schemas[path] = schema
		res.SchemaChanged = true
	}

	// The channel this will be posted into
	res.Channel = fmt.Sprintf("stream/%s/%s", s.slug, path)
	return res, nil
}

// GetSchema retrieves schema for a channel.
func (s *ManagedStream) GetSchema(path string) (json.RawMessage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	schema, ok := s.schemas[path]
	return schema, ok
}

func (s *ManagedStream) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	logger.Info("subscribe", "CTX", ctx, "XXX", req.PluginContext)

	schema, ok := s.GetSchema(req.Path)
	response := &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}
	if ok {
		response.Data = schema
	}
	return response, nil
}

func (p *ManagedStream) PublishStream(_ context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (p *ManagedStream) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
	return nil
}

package live

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// ManagedStream holds the state of a managed stream
type ManagedStream struct {
	mu        sync.RWMutex
	start     time.Time
	slug      string
	last      map[string]json.RawMessage
	publisher models.ChannelPublisher
}

// NewCache creates new Cache.
func NewManagedStream(id string, publisher models.ChannelPublisher) *ManagedStream {
	return &ManagedStream{
		slug:      id,
		start:     time.Now(),
		last:      map[string]json.RawMessage{},
		publisher: publisher,
	}
}

// GetInfo returns info for the UI about this stream
func (s *ManagedStream) ListChannels(prefix string) []util.DynMap {
	s.mu.RLock()
	defer s.mu.RUnlock()

	info := make([]util.DynMap, 0, len(s.last))
	for k, v := range s.last {
		ch := util.DynMap{}
		ch["channel"] = prefix + k
		ch["data"] = v
		info = append(info, ch)
	}
	return info
}

// Push send data to the stream and optionally process it
func (s *ManagedStream) Push(path string, frame *data.Frame) error {
	// Keep schema + data for last packet
	packet, err := data.FrameToJSON(frame, true, true)
	if err != nil {
		logger.Error("Error marshaling Frame to Schema", "error", err)
		return err
	}

	// Locks until we totally finish?
	s.mu.Lock()
	defer s.mu.Unlock()

	_, exists := s.last[path]
	s.last[path] = packet

	// when the packet already exits, only send the data
	if exists {
		packet, err = data.FrameToJSON(frame, false, true)
		if err != nil {
			logger.Error("Error marshaling Frame to JSON", "error", err)
			return err
		}
	}

	// The channel this will be posted into
	channel := fmt.Sprintf("stream/%s/%s", s.slug, path)
	logger.Debug("publish data to channel", "channel", channel) //, "data", string(packet))
	return s.publisher(channel, packet)
}

// GetSchema retrieves schema for a channel.
func (s *ManagedStream) GetLastPacket(path string) (json.RawMessage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	schema, ok := s.last[path]
	return schema, ok
}

func (s *ManagedStream) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	logger.Info("subscribe", "CTX", ctx, "XXX", req.PluginContext)

	packet, ok := s.GetLastPacket(req.Path)
	response := &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}
	if ok {
		response.Data = packet
	}
	return response, nil
}

func (s *ManagedStream) PublishStream(_ context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (s *ManagedStream) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
	return nil
}

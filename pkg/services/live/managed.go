package live

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// ManagedStreamRunner keeps ManagedStream per streamID.
type ManagedStreamRunner struct {
	mu        sync.RWMutex
	streams   map[string]*ManagedStream
	publisher models.ChannelPublisher
}

// NewManagedStreamRunner creates new ManagedStreamRunner.
func NewManagedStreamRunner(publisher models.ChannelPublisher) *ManagedStreamRunner {
	return &ManagedStreamRunner{
		publisher: publisher,
		streams:   map[string]*ManagedStream{},
	}
}

// Streams returns a map of active managed streams (per streamID).
func (r *ManagedStreamRunner) Streams() map[string]*ManagedStream {
	r.mu.RLock()
	defer r.mu.RUnlock()
	streams := make(map[string]*ManagedStream, len(r.streams))
	for k, v := range r.streams {
		streams[k] = v
	}
	return streams
}

// GetOrCreateStream -- for now this will create new manager for each key.
// Eventually, the stream behavior will need to be configured explicitly
func (r *ManagedStreamRunner) GetOrCreateStream(streamID string) (*ManagedStream, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.streams[streamID]
	if !ok {
		s = NewManagedStream(streamID, r.publisher)
		r.streams[streamID] = s
	}
	return s, nil
}

// ManagedStream holds the state of a managed stream.
type ManagedStream struct {
	mu        sync.RWMutex
	id        string
	start     time.Time
	last      map[string]json.RawMessage
	publisher models.ChannelPublisher
}

// NewManagedStream creates new ManagedStream.
func NewManagedStream(id string, publisher models.ChannelPublisher) *ManagedStream {
	return &ManagedStream{
		id:        id,
		start:     time.Now(),
		last:      map[string]json.RawMessage{},
		publisher: publisher,
	}
}

// ListChannels returns info for the UI about this stream.
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

// Push sends frame to the stream and saves it for later retrieval by subscribers.
func (s *ManagedStream) Push(path string, frame *data.Frame) error {
	// Keep schema + data for last packet.
	frameJSON, err := data.FrameToJSON(frame, true, true)
	if err != nil {
		logger.Error("Error marshaling Frame to Schema", "error", err)
		return err
	}

	// Locks until we totally finish?
	s.mu.Lock()
	defer s.mu.Unlock()

	_, exists := s.last[path]
	s.last[path] = frameJSON

	// When the packet already exits, only send the data.
	if exists {
		frameJSON, err = data.FrameToJSON(frame, false, true)
		if err != nil {
			logger.Error("Error marshaling Frame to JSON", "error", err)
			return err
		}
	}

	// The channel this will be posted into.
	channel := live.Channel{Scope: live.ScopeStream, Namespace: s.id, Path: path}.String()
	logger.Debug("Publish data to channel", "channel", channel, "dataLength", len(frameJSON))
	return s.publisher(channel, frameJSON)
}

// getLastPacket retrieves schema for a channel.
func (s *ManagedStream) getLastPacket(path string) (json.RawMessage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	schema, ok := s.last[path]
	return schema, ok
}

func (s *ManagedStream) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return s, nil
}

func (s *ManagedStream) OnSubscribe(_ context.Context, _ *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := models.SubscribeReply{}
	packet, ok := s.getLastPacket(e.Path)
	if ok {
		reply.Data = packet
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

func (s *ManagedStream) OnPublish(_ context.Context, _ *models.SignedInUser, evt models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	var frame data.Frame
	err := json.Unmarshal(evt.Data, &frame)
	if err != nil {
		// Stream scope only deals with data frames.
		return models.PublishReply{}, 0, err
	}
	err = s.Push(evt.Path, &frame)
	if err != nil {
		// Stream scope only deals with data frames.
		return models.PublishReply{}, 0, err
	}
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}

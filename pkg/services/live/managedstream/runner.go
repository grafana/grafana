package managedstream

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger = log.New("live.managed_stream")
)

// Runner keeps ManagedStream per streamID.
type Runner struct {
	mu        sync.RWMutex
	streams   map[int64]map[string]*ManagedStream
	publisher models.ChannelPublisher
}

// NewRunner creates new Runner.
func NewRunner(publisher models.ChannelPublisher) *Runner {
	return &Runner{
		publisher: publisher,
		streams:   map[int64]map[string]*ManagedStream{},
	}
}

// Streams returns a map of active managed streams (per streamID).
func (r *Runner) Streams(orgID int64) map[string]*ManagedStream {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if _, ok := r.streams[orgID]; !ok {
		return map[string]*ManagedStream{}
	}
	streams := make(map[string]*ManagedStream, len(r.streams[orgID]))
	for k, v := range r.streams[orgID] {
		streams[k] = v
	}
	return streams
}

// GetOrCreateStream -- for now this will create new manager for each key.
// Eventually, the stream behavior will need to be configured explicitly
func (r *Runner) GetOrCreateStream(orgID int64, streamID string) (*ManagedStream, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.streams[orgID]
	if !ok {
		r.streams[orgID] = map[string]*ManagedStream{}
	}
	s, ok := r.streams[orgID][streamID]
	if !ok {
		s = NewManagedStream(streamID, r.publisher)
		r.streams[orgID][streamID] = s
	}
	return s, nil
}

// ManagedStream holds the state of a managed stream.
type ManagedStream struct {
	mu        sync.RWMutex
	id        string
	start     time.Time
	last      map[int64]map[string]json.RawMessage
	publisher models.ChannelPublisher
}

// NewManagedStream creates new ManagedStream.
func NewManagedStream(id string, publisher models.ChannelPublisher) *ManagedStream {
	return &ManagedStream{
		id:        id,
		start:     time.Now(),
		last:      map[int64]map[string]json.RawMessage{},
		publisher: publisher,
	}
}

// ListChannels returns info for the UI about this stream.
func (s *ManagedStream) ListChannels(orgID int64, prefix string) []util.DynMap {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, ok := s.last[orgID]; !ok {
		return []util.DynMap{}
	}

	info := make([]util.DynMap, 0, len(s.last[orgID]))
	for k, v := range s.last[orgID] {
		ch := util.DynMap{}
		ch["channel"] = prefix + k
		ch["data"] = v
		info = append(info, ch)
	}
	return info
}

// Push sends frame to the stream and saves it for later retrieval by subscribers.
// unstableSchema flag can be set to disable schema caching for a path.
func (s *ManagedStream) Push(orgID int64, path string, frame *data.Frame, unstableSchema bool) error {
	// Keep schema + data for last packet.
	frameJSONWrapper, err := data.FrameToJSON(frame)
	if err != nil {
		logger.Error("Error marshaling frame with Schema", "error", err)
		return err
	}
	frameJSON := frameJSONWrapper.Bytes(data.IncludeAll)

	if !unstableSchema {
		// If schema is stable we can safely cache it, and only send values if
		// stream already has schema cached.
		s.mu.Lock()
		if _, ok := s.last[orgID]; !ok {
			s.last[orgID] = map[string]json.RawMessage{}
		}
		_, exists := s.last[orgID][path]
		s.last[orgID][path] = frameJSON
		s.mu.Unlock()

		// When the packet already exits, only send the data.
		// TODO: maybe a good idea would be MarshalJSON function of
		// frame to keep Schema JSON and Values JSON in frame object
		// to avoid encoding twice.
		if exists {
			frameJSONWrapper, err = data.FrameToJSON(frame)
			if err != nil {
				logger.Error("Error marshaling Frame to JSON", "error", err)
				return err
			}
			frameJSON = frameJSONWrapper.Bytes(data.IncludeDataOnly)
		}
	} else {
		// For unstable schema we always need to send everything to a connection.
		// And we don't want to cache schema for unstable case. But we still need to
		// set path to a map to make stream visible in UI stream select widget.
		s.mu.Lock()
		if _, ok := s.last[orgID]; ok {
			s.last[orgID][path] = nil
		}
		s.mu.Unlock()
	}
	// The channel this will be posted into.
	channel := live.Channel{Scope: live.ScopeStream, Namespace: s.id, Path: path}.String()
	logger.Debug("Publish data to channel", "channel", channel, "dataLength", len(frameJSON))
	return s.publisher(orgID, channel, frameJSON)
}

// getLastPacket retrieves schema for a channel.
func (s *ManagedStream) getLastPacket(orgId int64, path string) (json.RawMessage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.last[orgId]
	if !ok {
		return nil, false
	}
	schema, ok := s.last[orgId][path]
	return schema, ok && schema != nil
}

func (s *ManagedStream) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return s, nil
}

func (s *ManagedStream) OnSubscribe(_ context.Context, u *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := models.SubscribeReply{}
	packet, ok := s.getLastPacket(u.OrgId, e.Path)
	if ok {
		reply.Data = packet
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

func (s *ManagedStream) OnPublish(_ context.Context, u *models.SignedInUser, evt models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	var frame data.Frame
	err := json.Unmarshal(evt.Data, &frame)
	if err != nil {
		// Stream scope only deals with data frames.
		return models.PublishReply{}, 0, err
	}
	err = s.Push(u.OrgId, evt.Path, &frame, true)
	if err != nil {
		// Stream scope only deals with data frames.
		return models.PublishReply{}, 0, err
	}
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}

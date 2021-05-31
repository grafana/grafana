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
)

var (
	logger = log.New("live.managed_stream")
)

type ManagedChannel struct {
	Channel string          `json:"channel"`
	Data    json.RawMessage `json:"data"`
}

// Runner keeps ManagedStream per streamID.
type Runner struct {
	mu         sync.RWMutex
	streams    map[int64]map[string]*ManagedStream
	publisher  models.ChannelPublisher
	frameCache FrameCache
}

// FrameCache allows updating frame schema. Returns true is schema not changed.
type FrameCache interface {
	GetActivePaths(orgID int64) (map[string]json.RawMessage, error)
	GetSchema(orgID int64, path string) (json.RawMessage, bool, error)
	GetFrame(orgID int64, path string) (json.RawMessage, bool, error)
	Update(orgID int64, path string, frame *data.Frame) (data.FrameJSONCache, bool, error)
}

// NewRunner creates new Runner.
func NewRunner(publisher models.ChannelPublisher, schemaUpdater FrameCache) *Runner {
	return &Runner{
		publisher:  publisher,
		streams:    map[int64]map[string]*ManagedStream{},
		frameCache: schemaUpdater,
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
		s = NewManagedStream(streamID, r.publisher, r.frameCache)
		r.streams[orgID][streamID] = s
	}
	return s, nil
}

// ManagedStream holds the state of a managed stream.
type ManagedStream struct {
	mu         sync.RWMutex
	id         string
	start      time.Time
	last       map[int64]map[string]struct{}
	publisher  models.ChannelPublisher
	frameCache FrameCache
}

// NewManagedStream creates new ManagedStream.
func NewManagedStream(id string, publisher models.ChannelPublisher, schemaUpdater FrameCache) *ManagedStream {
	return &ManagedStream{
		id:         id,
		start:      time.Now(),
		last:       map[int64]map[string]struct{}{},
		publisher:  publisher,
		frameCache: schemaUpdater,
	}
}

// ListChannels returns info for the UI about this stream.
func (s *ManagedStream) ListChannels(orgID int64, prefix string) []*ManagedChannel {
	paths, err := s.frameCache.GetActivePaths(orgID)
	if err != nil {
		// TODO: log.
		return []*ManagedChannel{}
	}
	info := make([]*ManagedChannel, 0, len(paths))
	for k, v := range paths {
		managedChannel := &ManagedChannel{
			Channel: prefix + k,
			Data:    v,
		}
		info = append(info, managedChannel)
	}
	return info
}

// Push sends frame to the stream and saves it for later retrieval by subscribers.
// unstableSchema flag can be set to disable schema caching for a path.
func (s *ManagedStream) Push(orgID int64, path string, frame *data.Frame) error {
	//// Keep schema + data for last packet.
	//msg, err := data.FrameToJSONCache(frame)
	//if err != nil {
	//	logger.Error("Error marshaling frame with data", "error", err)
	//	return err
	//}
	//
	//s.mu.Lock()
	//if _, ok := s.last[orgID]; !ok {
	//	s.last[orgID] = map[string]struct{}{}
	//}
	//s.last[orgID][path] = struct{}{}
	//s.mu.Unlock()

	msg, isUpdated, err := s.frameCache.Update(orgID, path, frame)
	if err != nil {
		logger.Error("Error updating managed stream schema", "error", err)
		return err
	}

	// When the schema has not changed, just send the data.
	include := data.IncludeDataOnly
	if isUpdated {
		// When the schema has been changed, send all.
		include = data.IncludeAll
	}
	frameJSON := msg.Bytes(include)

	// The channel this will be posted into.
	channel := live.Channel{Scope: live.ScopeStream, Namespace: s.id, Path: path}.String()
	logger.Debug("Publish data to channel", "channel", channel, "dataLength", len(frameJSON))
	return s.publisher(orgID, channel, frameJSON)
}

func (s *ManagedStream) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return s, nil
}

func (s *ManagedStream) OnSubscribe(_ context.Context, u *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := models.SubscribeReply{}
	packet, ok, err := s.frameCache.GetFrame(u.OrgId, e.Path)
	if err != nil {
		return reply, 0, err
	}
	if ok {
		reply.Data = packet
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

func (s *ManagedStream) OnPublish(_ context.Context, _ *models.SignedInUser, _ models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	return models.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}

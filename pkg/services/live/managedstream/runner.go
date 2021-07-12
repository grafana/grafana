package managedstream

import (
	"context"
	"encoding/json"
	"fmt"
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

// Runner keeps ManagedStream per streamID.
type Runner struct {
	mu         sync.RWMutex
	streams    map[int64]map[string]*ManagedStream
	publisher  models.ChannelPublisher
	frameCache FrameCache
}

// NewRunner creates new Runner.
func NewRunner(publisher models.ChannelPublisher, frameCache FrameCache) *Runner {
	return &Runner{
		publisher:  publisher,
		streams:    map[int64]map[string]*ManagedStream{},
		frameCache: frameCache,
	}
}

func (r *Runner) GetManagedChannels(orgID int64) ([]*ManagedChannel, error) {
	channels := make([]*ManagedChannel, 0)
	for _, v := range r.Streams(orgID) {
		streamChannels, err := v.ListChannels(orgID)
		if err != nil {
			return nil, err
		}
		channels = append(channels, streamChannels...)
	}

	// Hardcode sample streams
	frameJSON, err := data.FrameToJSON(data.NewFrame("testdata",
		data.NewField("Time", nil, make([]time.Time, 0)),
		data.NewField("Value", nil, make([]float64, 0)),
		data.NewField("Min", nil, make([]float64, 0)),
		data.NewField("Max", nil, make([]float64, 0)),
	), data.IncludeSchemaOnly)
	if err == nil {
		channels = append(channels, &ManagedChannel{
			Channel: "plugin/testdata/random-2s-stream",
			Data:    frameJSON,
		}, &ManagedChannel{
			Channel: "plugin/testdata/random-flakey-stream",
			Data:    frameJSON,
		}, &ManagedChannel{
			Channel: "plugin/testdata/random-20Hz-stream",
			Data:    frameJSON,
		})
	}
	return channels, nil
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
	id         string
	start      time.Time
	publisher  models.ChannelPublisher
	frameCache FrameCache
}

// NewManagedStream creates new ManagedStream.
func NewManagedStream(id string, publisher models.ChannelPublisher, schemaUpdater FrameCache) *ManagedStream {
	return &ManagedStream{
		id:         id,
		start:      time.Now(),
		publisher:  publisher,
		frameCache: schemaUpdater,
	}
}

// ManagedChannel represents a managed stream.
type ManagedChannel struct {
	Channel string          `json:"channel"`
	Data    json.RawMessage `json:"data"`
}

// ListChannels returns info for the UI about this stream.
func (s *ManagedStream) ListChannels(orgID int64) ([]*ManagedChannel, error) {
	paths, err := s.frameCache.GetActiveChannels(orgID)
	if err != nil {
		return []*ManagedChannel{}, fmt.Errorf("error getting active managed stream paths: %v", err)
	}
	info := make([]*ManagedChannel, 0, len(paths))
	for k, v := range paths {
		managedChannel := &ManagedChannel{
			Channel: k,
			Data:    v,
		}
		info = append(info, managedChannel)
	}
	return info, nil
}

// Push sends frame to the stream and saves it for later retrieval by subscribers.
// unstableSchema flag can be set to disable schema caching for a path.
func (s *ManagedStream) Push(orgID int64, path string, frame *data.Frame) error {
	jsonFrameCache, err := data.FrameToJSONCache(frame)
	if err != nil {
		return err
	}

	// The channel this will be posted into.
	channel := live.Channel{Scope: live.ScopeStream, Namespace: s.id, Path: path}.String()

	isUpdated, err := s.frameCache.Update(orgID, channel, jsonFrameCache)
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
	frameJSON := jsonFrameCache.Bytes(include)

	logger.Debug("Publish data to channel", "channel", channel, "dataLength", len(frameJSON))
	return s.publisher(orgID, channel, frameJSON)
}

func (s *ManagedStream) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return s, nil
}

func (s *ManagedStream) OnSubscribe(_ context.Context, u *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := models.SubscribeReply{}
	frameJSON, ok, err := s.frameCache.GetFrame(u.OrgId, e.Channel)
	if err != nil {
		return reply, 0, err
	}
	if ok {
		reply.Data = frameJSON
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

func (s *ManagedStream) OnPublish(_ context.Context, _ *models.SignedInUser, _ models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	return models.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}

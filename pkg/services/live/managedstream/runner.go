package managedstream

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
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
	activeChannels, err := r.frameCache.GetActiveChannels(orgID)
	if err != nil {
		return []*ManagedChannel{}, fmt.Errorf("error getting active managed stream paths: %v", err)
	}
	channels := make([]*ManagedChannel, 0, len(activeChannels))
	for ch, schema := range activeChannels {
		managedChannel := &ManagedChannel{
			Channel: ch,
			Data:    schema,
		}
		// Enrich with minute rate.
		channel, _ := live.ParseChannel(managedChannel.Channel)
		namespaceStream, ok := r.streams[orgID][channel.Namespace]
		if ok {
			managedChannel.MinuteRate = namespaceStream.minuteRate(channel.Path)
		}
		channels = append(channels, managedChannel)
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
			Channel:    "plugin/testdata/random-2s-stream",
			Data:       frameJSON,
			MinuteRate: 30,
		}, &ManagedChannel{
			Channel:    "plugin/testdata/random-flakey-stream",
			Data:       frameJSON,
			MinuteRate: 150,
		}, &ManagedChannel{
			Channel:    "plugin/testdata/random-20Hz-stream",
			Data:       frameJSON,
			MinuteRate: 1200,
		})
	}

	sort.Slice(channels, func(i, j int) bool {
		return channels[i].Channel < channels[j].Channel
	})

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
		s = NewManagedStream(streamID, orgID, r.publisher, r.frameCache)
		r.streams[orgID][streamID] = s
	}
	return s, nil
}

// ManagedStream holds the state of a managed stream.
type ManagedStream struct {
	id         string
	orgID      int64
	start      time.Time
	publisher  models.ChannelPublisher
	frameCache FrameCache
	rateMu     sync.RWMutex
	rates      map[string][60]rateEntry
}

type rateEntry struct {
	time  uint32
	count int32
}

// NewManagedStream creates new ManagedStream.
func NewManagedStream(id string, orgID int64, publisher models.ChannelPublisher, schemaUpdater FrameCache) *ManagedStream {
	return &ManagedStream{
		id:         id,
		orgID:      orgID,
		start:      time.Now(),
		publisher:  publisher,
		frameCache: schemaUpdater,
		rates:      map[string][60]rateEntry{},
	}
}

// ManagedChannel represents a managed stream.
type ManagedChannel struct {
	Channel    string          `json:"channel"`
	MinuteRate int64           `json:"minute_rate"`
	Data       json.RawMessage `json:"data"`
}

// Push sends frame to the stream and saves it for later retrieval by subscribers.
// unstableSchema flag can be set to disable schema caching for a path.
func (s *ManagedStream) Push(path string, frame *data.Frame) error {
	jsonFrameCache, err := data.FrameToJSONCache(frame)
	if err != nil {
		return err
	}

	// The channel this will be posted into.
	channel := live.Channel{Scope: live.ScopeStream, Namespace: s.id, Path: path}.String()

	isUpdated, err := s.frameCache.Update(s.orgID, channel, jsonFrameCache)
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
	s.incRate(path, time.Now().Unix())
	return s.publisher(s.orgID, channel, frameJSON)
}

func (s *ManagedStream) incRate(path string, nowUnix int64) {
	s.rateMu.Lock()
	pathRate, ok := s.rates[path]
	if !ok {
		pathRate = [60]rateEntry{}
	}
	now := time.Unix(nowUnix, 0)
	slot := now.Second() % 60
	if pathRate[slot].time != uint32(nowUnix) {
		pathRate[slot].count = 0
	}
	pathRate[slot].time = uint32(nowUnix)
	pathRate[slot].count += 1
	s.rates[path] = pathRate
	s.rateMu.Unlock()
}

func (s *ManagedStream) minuteRate(path string) int64 {
	var total int64
	s.rateMu.RLock()
	defer s.rateMu.RUnlock()
	pathRate, ok := s.rates[path]
	if !ok {
		return 0
	}
	for _, val := range pathRate {
		if val.time > uint32(time.Now().Unix()-60) {
			total += int64(val.count)
		}
	}
	return total
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

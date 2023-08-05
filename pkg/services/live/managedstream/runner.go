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
	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	logger = log.New("live.managed_stream")
)

// If message comes from a plugin:
// 	* it's simply sent to local subscribers without any additional steps
//  * if there is RULE then may be processed in some way
//  * important to keep a message in the original channel
// 	* client subscribed to ds/<UID>/xxx
//
// What we want to build:
// 	* Stream scope not hardcoded and determined by the caller
// 	* So it's possible to use managed stream from plugins
// 	* The problem is HA – at moment several plugins on different nodes publish same messages
// 	* Can use in-memory managed stream for plugins with local subscribers publish, use HA-managed stream for HTTP/WS
// 	* Eventually maintain a single connection with a plugin over a channel leader selection.

// Runner keeps NamespaceStream per namespace.
type Runner struct {
	mu             sync.RWMutex
	streams        map[int64]map[string]*NamespaceStream
	publisher      model.ChannelPublisher
	localPublisher LocalPublisher
	frameCache     FrameCache
}

type LocalPublisher interface {
	PublishLocal(channel string, data []byte) error
}

// NewRunner creates new Runner.
func NewRunner(publisher model.ChannelPublisher, localPublisher LocalPublisher, frameCache FrameCache) *Runner {
	return &Runner{
		publisher:      publisher,
		localPublisher: localPublisher,
		streams:        map[int64]map[string]*NamespaceStream{},
		frameCache:     frameCache,
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
		prefix := channel.Scope + "/" + channel.Namespace
		namespaceStream, ok := r.streams[orgID][prefix]
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
			Channel:    "plugin/testdata/random-labeled-stream",
			Data:       frameJSON,
			MinuteRate: 250,
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

// GetOrCreateStream -- for now this will create new manager for each key.
// Eventually, the stream behavior will need to be configured explicitly
func (r *Runner) GetOrCreateStream(orgID int64, scope string, namespace string) (*NamespaceStream, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.streams[orgID]
	if !ok {
		r.streams[orgID] = map[string]*NamespaceStream{}
	}
	prefix := scope + "/" + namespace
	s, ok := r.streams[orgID][prefix]
	if !ok {
		s = NewNamespaceStream(orgID, scope, namespace, r.publisher, r.localPublisher, r.frameCache)
		r.streams[orgID][prefix] = s
	}
	return s, nil
}

// NamespaceStream holds the state of a managed stream.
type NamespaceStream struct {
	orgID          int64
	scope          string
	namespace      string
	publisher      model.ChannelPublisher
	localPublisher LocalPublisher
	frameCache     FrameCache
	rateMu         sync.RWMutex
	rates          map[string][60]rateEntry
}

type rateEntry struct {
	time  uint32
	count int32
}

// ManagedChannel represents a managed stream.
type ManagedChannel struct {
	Channel    string          `json:"channel"`
	MinuteRate int64           `json:"minute_rate"`
	Data       json.RawMessage `json:"data"`
}

// NewNamespaceStream creates new NamespaceStream.
func NewNamespaceStream(orgID int64, scope string, namespace string, publisher model.ChannelPublisher, localPublisher LocalPublisher, schemaUpdater FrameCache) *NamespaceStream {
	return &NamespaceStream{
		orgID:          orgID,
		scope:          scope,
		namespace:      namespace,
		publisher:      publisher,
		localPublisher: localPublisher,
		frameCache:     schemaUpdater,
		rates:          map[string][60]rateEntry{},
	}
}

// Push sends frame to the stream and saves it for later retrieval by subscribers.
// * Saves the entire frame to cache.
// * If schema has been changed sends entire frame to channel, otherwise only data.
func (s *NamespaceStream) Push(ctx context.Context, path string, frame *data.Frame) error {
	jsonFrameCache, err := data.FrameToJSONCache(frame)
	if err != nil {
		return err
	}

	// The channel this will be posted into.
	channel := live.Channel{Scope: s.scope, Namespace: s.namespace, Path: path}.String()

	isUpdated, err := s.frameCache.Update(ctx, s.orgID, channel, jsonFrameCache)
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
	if s.scope == live.ScopeDatasource || s.scope == live.ScopePlugin {
		return s.localPublisher.PublishLocal(orgchannel.PrependOrgID(s.orgID, channel), frameJSON)
	}
	return s.publisher(s.orgID, channel, frameJSON)
}

func (s *NamespaceStream) incRate(path string, nowUnix int64) {
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

func (s *NamespaceStream) minuteRate(path string) int64 {
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

func (s *NamespaceStream) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return s, nil
}

func (s *NamespaceStream) OnSubscribe(ctx context.Context, u *user.SignedInUser, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := model.SubscribeReply{}
	frameJSON, ok, err := s.frameCache.GetFrame(ctx, u.OrgID, e.Channel)
	if err != nil {
		return reply, 0, err
	}
	if ok {
		reply.Data = frameJSON
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

func (s *NamespaceStream) OnPublish(_ context.Context, _ *user.SignedInUser, _ model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}

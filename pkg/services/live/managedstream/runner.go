package managedstream

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/live/orgchannel"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/remotewrite"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

//go:generate mockgen -destination=runner_mock.go -package=managedstream github.com/grafana/grafana/pkg/services/live/managedstream RuleCacheGetter

var (
	logger = log.New("live.managed_stream")
)

// Runner keeps ManagedStream per streamID.
type Runner struct {
	mu         sync.RWMutex
	streams    map[int64]map[string]*ManagedStream
	publisher  models.ChannelPublisher
	frameCache FrameCache
	ruleCache  RuleCacheGetter
}

type RuleCacheGetter interface {
	Get(orgID int64, channel string) (*models.LiveChannelRule, bool, error)
}

// NewRunner creates new Runner.
func NewRunner(publisher models.ChannelPublisher, frameCache FrameCache, ruleCache RuleCacheGetter) *Runner {
	return &Runner{
		publisher:  publisher,
		streams:    map[int64]map[string]*ManagedStream{},
		frameCache: frameCache,
		ruleCache:  ruleCache,
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
		s = NewManagedStream(streamID, r.publisher, r.frameCache, r.ruleCache)
		r.streams[orgID][streamID] = s
	}
	return s, nil
}

// ManagedStream holds the state of a managed stream.
type ManagedStream struct {
	id                string
	start             time.Time
	publisher         models.ChannelPublisher
	frameCache        FrameCache
	ruleCache         RuleCacheGetter
	remoteWrite       chan *remoteWriteRequest
	remoteWriteTime   map[string]time.Time
	remoteWriteTimeMu sync.Mutex
}

// NewManagedStream creates new ManagedStream.
func NewManagedStream(id string, publisher models.ChannelPublisher, frameCache FrameCache, ruleCache RuleCacheGetter) *ManagedStream {
	s := &ManagedStream{
		id:              id,
		start:           time.Now(),
		publisher:       publisher,
		frameCache:      frameCache,
		ruleCache:       ruleCache,
		remoteWrite:     make(chan *remoteWriteRequest, 128),
		remoteWriteTime: map[string]time.Time{},
	}
	go s.processRemoteWrite()
	return s
}

type remoteWriteRequest struct {
	data     []byte
	config   models.RemoteWriteConfig
	password string
}

// ManagedChannel represents a managed stream.
type ManagedChannel struct {
	Channel string          `json:"channel"`
	Data    json.RawMessage `json:"data"`
}

func (s *ManagedStream) processRemoteWrite() {
	httpClient := &http.Client{
		Timeout: 500 * time.Millisecond,
	}

	for {
		r := <-s.remoteWrite
		if r.config.Endpoint == "" {
			logger.Debug("Skip sending to remote write: no url")
			continue
		}
		logger.Debug("Sending to remote write endpoint", "url", r.config.Endpoint, "bodyLength", len(r.data))
		req, err := http.NewRequest(http.MethodPost, r.config.Endpoint, bytes.NewReader(r.data))
		if err != nil {
			logger.Error("Error constructing remote write request", "error", err)
			continue
		}
		req.Header.Set("Content-Type", "application/x-protobuf")
		req.Header.Set("Content-Encoding", "snappy")
		req.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")
		req.SetBasicAuth(r.config.User, r.password)

		started := time.Now()
		resp, err := httpClient.Do(req)
		if err != nil {
			logger.Error("Error sending remote write request", "error", err)
			continue
		}
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			logger.Error("Unexpected response code from remote write endpoint", "code", resp.StatusCode)
			continue
		}
		logger.Debug("Successfully sent to remote write endpoint", "url", r.config.Endpoint, "elapsed", time.Since(started))
	}
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

	rule, ok, err := s.ruleCache.Get(orgID, channel)
	if err != nil {
		return fmt.Errorf("error getting channel rule from cache: %w", err)
	}
	if ok && rule.Config.RemoteWrite != nil && rule.Config.RemoteWrite.Enabled {
		err := s.remoteWriteFrame(orgID, channel, *rule, frame)
		if err != nil {
			return fmt.Errorf("error during remote write: %w", err)
		}
	}

	logger.Debug("Publish data to channel", "channel", channel, "dataLength", len(frameJSON))
	return s.publisher(orgID, channel, frameJSON)
}

func (s *ManagedStream) remoteWriteFrame(orgID int64, channel string, rule models.LiveChannelRule, frame *data.Frame) error {
	remoteWriteConfig := *rule.Config.RemoteWrite
	s.remoteWriteTimeMu.Lock()
	orgChannel := orgchannel.PrependOrgID(orgID, channel)
	if t, ok := s.remoteWriteTime[orgChannel]; ok && remoteWriteConfig.SampleMilliseconds > 0 {
		if time.Now().Before(t.Add(time.Duration(remoteWriteConfig.SampleMilliseconds) * time.Millisecond)) {
			s.remoteWriteTimeMu.Unlock()
			return nil
		}
		// Save current time as time of remote write for a channel.
		s.remoteWriteTime[orgChannel] = time.Now()
	}
	s.remoteWriteTimeMu.Unlock()

	// Use remote write for a stream.
	remoteWriteData, err := remotewrite.SerializeLabelsColumn(frame)
	if err != nil {
		logger.Error("Error serializing to remote write format", "error", err)
	} else {
		password, ok := rule.Secure.DecryptedValue("remoteWritePassword")
		if !ok {
			logger.Warn("No password set for channel remote write", "orgId", orgID, "channel", channel)
		}
		select {
		case s.remoteWrite <- &remoteWriteRequest{
			data:     remoteWriteData,
			config:   remoteWriteConfig,
			password: password,
		}:
		default:
			logger.Warn("Remote write is slow, dropping frame")
		}
	}
	return nil
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

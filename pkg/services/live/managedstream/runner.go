package managedstream

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/remotewrite"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

var (
	logger = log.New("live.managed_stream")
)

// Runner keeps ManagedStream per streamID.
type Runner struct {
	mu        sync.RWMutex
	streams   map[string]*ManagedStream
	publisher models.ChannelPublisher
}

// NewRunner creates new Runner.
func NewRunner(publisher models.ChannelPublisher) *Runner {
	return &Runner{
		publisher: publisher,
		streams:   map[string]*ManagedStream{},
	}
}

// Streams returns a map of active managed streams (per streamID).
func (r *Runner) Streams() map[string]*ManagedStream {
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
func (r *Runner) GetOrCreateStream(streamID string) (*ManagedStream, error) {
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
	mu              sync.RWMutex
	id              string
	start           time.Time
	last            map[string]json.RawMessage
	publisher       models.ChannelPublisher
	remoteWriteData chan []byte
}

// NewManagedStream creates new ManagedStream.
func NewManagedStream(id string, publisher models.ChannelPublisher) *ManagedStream {
	s := &ManagedStream{
		id:              id,
		start:           time.Now(),
		last:            map[string]json.RawMessage{},
		publisher:       publisher,
		remoteWriteData: make(chan []byte, 128),
	}
	go s.remoteWrite()
	return s
}

func (s *ManagedStream) remoteWrite() {
	url := os.Getenv("GF_CLOUD_URL")
	user := os.Getenv("GF_CLOUD_USER")
	password := os.Getenv("GF_CLOUD_PASSWORD")

	httpClient := &http.Client{
		Timeout: 500 * time.Millisecond,
	}

	for {
		writeData := <-s.remoteWriteData
		if url == "" {
			logger.Debug("Skip sending to remote write: no url")
			continue
		}
		logger.Debug("Sending to remote write endpoint", "url", url, "bodyLength", len(writeData))
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(writeData))
		if err != nil {
			logger.Error("Error constructing remote write request", "error", err)
			continue
		}
		req.Header.Set("Content-Type", "application/x-protobuf")
		req.Header.Set("Content-Encoding", "snappy")
		req.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")
		req.SetBasicAuth(user, password)

		started := time.Now()
		resp, err := httpClient.Do(req)
		if err != nil {
			logger.Error("Error sending remote write request", "error", err)
			continue
		}
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			logger.Error("Unexpected response from remote write endpoint", "error", err)
			continue
		}
		logger.Debug("Successfully sent to remote write endpoint", "url", url, "elapsed", time.Since(started))
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
// unstableSchema flag can be set to disable schema caching for a path.
func (s *ManagedStream) Push(path string, frame *data.Frame, unstableSchema bool) error {
	// Keep schema + data for last packet.
	frameJSON, err := data.FrameToJSON(frame, true, true)
	if err != nil {
		logger.Error("Error marshaling frame with Schema", "error", err)
		return err
	}

	if !unstableSchema {
		// If schema is stable we can safely cache it, and only send values if
		// stream already has schema cached.
		s.mu.Lock()
		_, exists := s.last[path]
		s.last[path] = frameJSON
		s.mu.Unlock()

		// When the packet already exits, only send the data.
		// TODO: maybe a good idea would be MarshalJSON function of
		// frame to keep Schema JSON and Values JSON in frame object
		// to avoid encoding twice.
		if exists {
			frameJSON, err = data.FrameToJSON(frame, false, true)
			if err != nil {
				logger.Error("Error marshaling Frame to JSON", "error", err)
				return err
			}
		}
	} else {
		// For unstable schema we always need to send everything to a connection.
		// And we don't want to cache schema for unstable case. But we still need to
		// set path to a map to make stream visible in UI stream select widget.
		s.mu.Lock()
		s.last[path] = nil
		s.mu.Unlock()
	}

	remoteWriteData, err := remotewrite.Serialize(frame)
	if err != nil {
		logger.Error("Error serializing to remote write format", "error", err)
	} else {
		select {
		case s.remoteWriteData <- remoteWriteData:
		default:
			logger.Warn("Remote write is slow, dropping frame")
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
	return schema, ok && schema != nil
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
	err = s.Push(evt.Path, &frame, true)
	if err != nil {
		// Stream scope only deals with data frames.
		return models.PublishReply{}, 0, err
	}
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}

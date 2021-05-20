package managedstream

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
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
	mu              sync.RWMutex
	id              string
	start           time.Time
	last            map[int64]map[string]json.RawMessage
	publisher       models.ChannelPublisher
	remoteWriteData chan []byte
}

// NewManagedStream creates new ManagedStream.
func NewManagedStream(id string, publisher models.ChannelPublisher) *ManagedStream {
	s := &ManagedStream{
		id:              id,
		start:           time.Now(),
		last:            map[int64]map[string]json.RawMessage{},
		publisher:       publisher,
		remoteWriteData: make(chan []byte, 128),
	}
	go s.remoteWrite()
	return s
}

func (s *ManagedStream) remoteWrite() {
	url := os.Getenv("GF_LIVE_REMOTE_WRITE_URL")
	user := os.Getenv("GF_LIVE_REMOTE_WRITE_USER")
	password := os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD")

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
			logger.Error("Unexpected response code from remote write endpoint", "code", resp.StatusCode)
			continue
		}
		logger.Debug("Successfully sent to remote write endpoint", "url", url, "elapsed", time.Since(started))
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

func stringInSlice(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

var remoteWriteStreams = strings.Split(os.Getenv("GF_LIVE_REMOTE_WRITE_STREAMS"), ",")

// Push sends frame to the stream and saves it for later retrieval by subscribers.
// unstableSchema flag can be set to disable schema caching for a path.
func (s *ManagedStream) Push(orgID int64, path string, frame *data.Frame, unstableSchema bool) error {
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
		if _, ok := s.last[orgID]; ok {
			s.last[orgID][path] = nil
		}
		s.mu.Unlock()
	}

	if stringInSlice(remoteWriteStreams, s.id) {
		// Use remote write for a stream.
		remoteWriteData, err := remotewrite.SerializeLabelsColumn(frame)
		if err != nil {
			logger.Error("Error serializing to remote write format", "error", err)
		} else {
			select {
			case s.remoteWriteData <- remoteWriteData:
			default:
				logger.Warn("Remote write is slow, dropping frame")
			}
		}
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

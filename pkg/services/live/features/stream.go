package features

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// StreamManager manages streams from Grafana to plugins.
type StreamManager struct {
	mu             sync.RWMutex
	streams        map[string]struct{}
	presenceGetter PresenceGetter
	packetSender   StreamPacketSender
	registerCh     chan submitRequest
	closedCh       chan struct{}
	checkInterval  time.Duration
	maxChecks      int
}

// StreamManagerOption modifies StreamManager behavior (used for tests for example).
type StreamManagerOption func(*StreamManager)

// WithCheckConfig allows setting custom check rules.
func WithCheckConfig(interval time.Duration, maxChecks int) StreamManagerOption {
	return func(sm *StreamManager) {
		sm.checkInterval = interval
		sm.maxChecks = maxChecks
	}
}

const (
	defaultCheckInterval = 5 * time.Second
	defaultMaxChecks     = 3
)

// NewStreamManager creates new StreamManager.
func NewStreamManager(packetSender StreamPacketSender, presenceGetter PresenceGetter, opts ...StreamManagerOption) *StreamManager {
	sm := &StreamManager{
		streams:        make(map[string]struct{}),
		packetSender:   packetSender,
		presenceGetter: presenceGetter,
		registerCh:     make(chan submitRequest),
		closedCh:       make(chan struct{}),
		checkInterval:  defaultCheckInterval,
		maxChecks:      defaultMaxChecks,
	}
	for _, opt := range opts {
		opt(sm)
	}
	return sm
}

func (s *StreamManager) stopStream(sr streamRequest, cancelFn func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.streams, sr.Channel)
	cancelFn()
}

func (s *StreamManager) watchStream(ctx context.Context, cancelFn func(), sr streamRequest) {
	numNoSubscribersChecks := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(s.checkInterval):
			numSubscribers, err := s.presenceGetter.GetNumSubscribers(sr.Channel)
			if err != nil {
				logger.Error("Error checking num subscribers", "channel", sr.Channel, "path", sr.Path)
				continue
			}
			if numSubscribers > 0 {
				// reset counter since channel has active subscribers.
				numNoSubscribersChecks = 0
				continue
			}
			numNoSubscribersChecks++
			if numNoSubscribersChecks >= s.maxChecks {
				logger.Debug("Stop stream since no active subscribers", "channel", sr.Channel, "path", sr.Path)
				s.stopStream(sr, cancelFn)
				return
			}
		}
	}
}

// run stream until context canceled.
func (s *StreamManager) runStream(ctx context.Context, sr streamRequest) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		err := sr.StreamRunner.RunStream(
			ctx,
			&backend.RunStreamRequest{
				PluginContext: sr.PluginContext,
				Path:          sr.Path,
			},
			newStreamSender(sr.Channel, s.packetSender),
		)
		if err != nil {
			if errors.Is(ctx.Err(), context.Canceled) {
				logger.Debug("Stream cleanly finished", "path", sr.Path)
				return
			}
			logger.Error("Error running stream, retrying", "path", sr.Path, "error", err)
			continue
		}
		logger.Warn("Stream finished without error?", "path", sr.Path)
		return
	}
}

var errClosed = errors.New("stream manager closed")

func (s *StreamManager) registerStream(ctx context.Context, sr submitRequest) {
	s.mu.Lock()
	if _, ok := s.streams[sr.streamRequest.Channel]; ok {
		s.mu.Unlock()
		sr.responseCh <- submitResponse{Result: submitResult{StreamExists: true}}
		return
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	s.streams[sr.streamRequest.Channel] = struct{}{}
	s.mu.Unlock()
	sr.responseCh <- submitResponse{Result: submitResult{StreamExists: false}}
	go s.watchStream(ctx, cancel, sr.streamRequest)
	s.runStream(ctx, sr.streamRequest)
}

// Run StreamManager till context canceled.
func (s *StreamManager) Run(ctx context.Context) error {
	for {
		select {
		case sr := <-s.registerCh:
			go s.registerStream(ctx, sr)
		case <-ctx.Done():
			close(s.closedCh)
			return ctx.Err()
		}
	}
}

type streamRequest struct {
	Channel       string
	Path          string
	PluginContext backend.PluginContext
	StreamRunner  StreamRunner
}

type submitRequest struct {
	responseCh    chan submitResponse
	streamRequest streamRequest
}

type submitResult struct {
	StreamExists bool
}

type submitResponse struct {
	Error  error
	Result submitResult
}

// SubmitStream submits stream handler in StreamManager to manage.
// The stream will be opened and kept till channel has active subscribers.
func (s *StreamManager) SubmitStream(ctx context.Context, channel string, path string, pCtx backend.PluginContext, streamRunner StreamRunner) (*submitResult, error) {
	req := submitRequest{
		responseCh: make(chan submitResponse, 1),
		streamRequest: streamRequest{
			Channel:       channel,
			Path:          path,
			PluginContext: pCtx,
			StreamRunner:  streamRunner,
		},
	}

	// Send submit request.
	select {
	case s.registerCh <- req:
	case <-s.closedCh:
		close(s.registerCh)
		return nil, errClosed
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Wait for submit response.
	select {
	case resp := <-req.responseCh:
		if resp.Error != nil {
			return nil, resp.Error
		}
		return &resp.Result, nil
	case <-s.closedCh:
		return nil, errClosed
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

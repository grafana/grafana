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
	mu               sync.RWMutex
	streams          map[string]struct{}
	presenceGetter   PresenceGetter
	channelPublisher ChannelPublisher
	registerCh       chan streamRequest
	closedCh         chan struct{}
	checkInterval    time.Duration
	maxChecks        int
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
func NewStreamManager(chPublisher ChannelPublisher, presenceGetter PresenceGetter, opts ...StreamManagerOption) *StreamManager {
	sm := &StreamManager{
		streams:          make(map[string]struct{}),
		channelPublisher: chPublisher,
		presenceGetter:   presenceGetter,
		registerCh:       make(chan streamRequest),
		closedCh:         make(chan struct{}),
		checkInterval:    defaultCheckInterval,
		maxChecks:        defaultMaxChecks,
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
				logger.Info("Stop stream since no active subscribers", "channel", sr.Channel, "path", sr.Path)
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
			newStreamSender(sr.Channel, s.channelPublisher),
		)
		if err != nil {
			if errors.Is(ctx.Err(), context.Canceled) {
				logger.Info("Stream cleanly finished", "path", sr.Path)
				return
			}
			logger.Error("Error running stream, retrying", "path", sr.Path, "error", err)
			continue
		}
		logger.Warn("Stream finished without error?", "path", sr.Path)
		return
	}
}

func (s *StreamManager) registerStream(ctx context.Context, sr streamRequest) {
	s.mu.Lock()
	if _, ok := s.streams[sr.Channel]; ok {
		logger.Debug("Skip running new stream (already exists)", "path", sr.Path)
		s.mu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	s.streams[sr.Channel] = struct{}{}
	s.mu.Unlock()

	go s.watchStream(ctx, cancel, sr)
	s.runStream(ctx, sr)
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

// SubmitStream submits stream handler in StreamManager to manage.
// The stream will be opened and kept till channel has active subscribers.
func (s *StreamManager) SubmitStream(channel string, path string, pCtx backend.PluginContext, streamRunner StreamRunner) error {
	select {
	case <-s.closedCh:
		close(s.registerCh)
		return nil
	case s.registerCh <- streamRequest{
		Channel:       channel,
		Path:          path,
		PluginContext: pCtx,
		StreamRunner:  streamRunner,
	}:
	case <-time.After(time.Second):
		return errors.New("timeout")
	}
	return nil
}

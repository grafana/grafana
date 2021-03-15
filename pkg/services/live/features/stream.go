package features

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type cancelFunc func()

type StreamManager struct {
	mu               sync.RWMutex
	streams          map[string]cancelFunc
	presenceGetter   presenceGetter
	channelPublisher channelPublisher
	registerCh       chan streamRequest
	closedCh         chan struct{}
}

func NewStreamManager(channelPublisher channelPublisher, presenceGetter presenceGetter) *StreamManager {
	return &StreamManager{
		streams:          make(map[string]cancelFunc),
		channelPublisher: channelPublisher,
		presenceGetter:   presenceGetter,
		registerCh:       make(chan streamRequest),
		closedCh:         make(chan struct{}),
	}
}

func (s *StreamManager) watchStream(ctx context.Context, cancelFn func(), sr streamRequest) {
	numNoSubscribersChecks := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
			numSubscribers, err := s.presenceGetter.GetNumSubscribers(sr.Channel)
			if err != nil {
				continue
			}
			if numSubscribers == 0 {
				numNoSubscribersChecks++
				if numNoSubscribersChecks >= 3 {
					logger.Info("Stop stream since no active subscribers", "channel", sr.Channel, "path", sr.Path)
					s.mu.Lock()
					delete(s.streams, sr.Channel)
					cancelFn()
					s.mu.Unlock()
					return
				}
			} else {
				// reset counter since channel has active subscribers.
				numNoSubscribersChecks = 0
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
		err := sr.StreamHandler.RunStream(
			ctx,
			&backend.RunStreamRequest{
				PluginContext: sr.PluginContext,
				Path:          sr.Path,
			},
			newStreamSender(sr.Channel, s.channelPublisher),
		)
		if err != nil {
			if ctx.Err() == context.Canceled {
				logger.Info("Stream cleanly finished", "path", sr.Path)
				return
			}
			logger.Error("Error running stream, retrying", "path", sr.Path, "error", err)
		} else {
			logger.Warn("Stream finished without error?", "path", sr.Path)
		}
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
	s.streams[sr.Channel] = cancelFunc(cancel)
	s.mu.Unlock()

	go s.watchStream(ctx, cancel, sr)
	s.runStream(ctx, sr)
}

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
	StreamHandler backend.StreamHandler
}

func (s *StreamManager) SubmitStream(channel string, path string, pCtx backend.PluginContext, streamHandler backend.StreamHandler) error {
	select {
	case <-s.closedCh:
		close(s.registerCh)
		return nil
	case s.registerCh <- streamRequest{
		Channel:       channel,
		Path:          path,
		PluginContext: pCtx,
		StreamHandler: streamHandler,
	}:
	case <-time.After(time.Second):
		return errors.New("timeout")
	}
	return nil
}

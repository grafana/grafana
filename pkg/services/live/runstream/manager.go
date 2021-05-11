package runstream

import (
	"context"
	"errors"
	"math"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("live.runstream")
)

//go:generate mockgen -destination=mock.go -package=runstream github.com/grafana/grafana/pkg/services/live/runstream StreamPacketSender,PresenceGetter,StreamRunner

type StreamPacketSender interface {
	Send(channel string, packet *backend.StreamPacket) error
}

type PresenceGetter interface {
	GetNumSubscribers(channel string) (int, error)
}

type StreamRunner interface {
	RunStream(ctx context.Context, request *backend.RunStreamRequest, sender backend.StreamPacketSender) error
}

type streamSender struct {
	channel      string
	packetSender StreamPacketSender
}

func newStreamSender(channel string, packetSender StreamPacketSender) *streamSender {
	return &streamSender{
		channel:      channel,
		packetSender: packetSender,
	}
}

func (p *streamSender) Send(packet *backend.StreamPacket) error {
	return p.packetSender.Send(p.channel, packet)
}

// Manager manages streams from Grafana to plugins (i.e. RunStream method).
type Manager struct {
	mu             sync.RWMutex
	streams        map[string]chan struct{}
	presenceGetter PresenceGetter
	packetSender   StreamPacketSender
	registerCh     chan submitRequest
	closedCh       chan struct{}
	checkInterval  time.Duration
	maxChecks      int
}

// ManagerOption modifies Manager behavior (used for tests for example).
type ManagerOption func(*Manager)

// WithCheckConfig allows setting custom check rules.
func WithCheckConfig(interval time.Duration, maxChecks int) ManagerOption {
	return func(sm *Manager) {
		sm.checkInterval = interval
		sm.maxChecks = maxChecks
	}
}

const (
	defaultCheckInterval = 5 * time.Second
	defaultMaxChecks     = 3
)

// NewManager creates new Manager.
func NewManager(packetSender StreamPacketSender, presenceGetter PresenceGetter, opts ...ManagerOption) *Manager {
	sm := &Manager{
		streams:        make(map[string]chan struct{}),
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

func (s *Manager) stopStream(sr streamRequest, cancelFn func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	closeCh, ok := s.streams[sr.Channel]
	if !ok {
		return
	}
	delete(s.streams, sr.Channel)
	cancelFn()
	close(closeCh)
}

func (s *Manager) watchStream(ctx context.Context, cancelFn func(), sr streamRequest) {
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

const streamDurationThreshold = 100 * time.Millisecond
const coolDownDelay = 100 * time.Millisecond
const maxDelay = 5 * time.Second

func getDelay(numErrors int) time.Duration {
	if numErrors == 0 {
		return 0
	}
	delay := coolDownDelay * time.Duration(math.Pow(2, float64(numErrors)))
	if delay > maxDelay {
		return maxDelay
	}
	return delay
}

// run stream until context canceled or stream finished without an error.
func (s *Manager) runStream(ctx context.Context, cancelFn func(), sr streamRequest) {
	var numFastErrors int
	var delay time.Duration
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		startTime := time.Now()
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
			// Best effort to cool down re-establishment process. We don't have a
			// nice way to understand whether we really need to wait here - so relying
			// on RunStream duration time.
			if time.Since(startTime) < streamDurationThreshold {
				if delay < maxDelay {
					// Due to not calling getDelay after we have delay larger than maxDelay
					// we avoid possible float overflow errors while calculating delay duration
					// based on numFastErrors.
					delay = getDelay(numFastErrors)
				}
				numFastErrors++
			} else {
				// Assuming that stream successfully started.
				delay = 0
				numFastErrors = 0
			}
			logger.Error("Error running stream, re-establishing", "path", sr.Path, "error", err, "wait", delay)
			time.Sleep(delay)
			continue
		}
		logger.Debug("Stream finished without error, stopping it", "path", sr.Path)
		s.stopStream(sr, cancelFn)
		return
	}
}

var errClosed = errors.New("stream manager closed")

func (s *Manager) registerStream(ctx context.Context, sr submitRequest) {
	s.mu.Lock()
	if closeCh, ok := s.streams[sr.streamRequest.Channel]; ok {
		s.mu.Unlock()
		sr.responseCh <- submitResponse{Result: submitResult{StreamExists: true, CloseNotify: closeCh}}
		return
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	closeCh := make(chan struct{})
	s.streams[sr.streamRequest.Channel] = closeCh
	s.mu.Unlock()
	sr.responseCh <- submitResponse{Result: submitResult{StreamExists: false, CloseNotify: closeCh}}
	go s.watchStream(ctx, cancel, sr.streamRequest)
	s.runStream(ctx, cancel, sr.streamRequest)
}

// Run Manager till context canceled.
func (s *Manager) Run(ctx context.Context) error {
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
	// StreamExists tells whether stream have been already opened.
	StreamExists bool
	// CloseNotify will be closed as soon as stream cleanly exited.
	CloseNotify chan struct{}
}

type submitResponse struct {
	Error  error
	Result submitResult
}

// SubmitStream submits stream handler in Manager to manage.
// The stream will be opened and kept till channel has active subscribers.
func (s *Manager) SubmitStream(ctx context.Context, orgID int64, channel string, path string, pCtx backend.PluginContext, streamRunner StreamRunner) (*submitResult, error) {
	req := submitRequest{
		responseCh: make(chan submitResponse, 1),
		streamRequest: streamRequest{
			Channel:       orgchannel.PrependOrgID(orgID, channel),
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

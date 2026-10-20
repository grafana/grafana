package notifier

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	alertBroadcastKey = "alerts:broadcast"
	alertBroadcastDropLogInterval = 10 * time.Second
)

type AlertBroadcastPayload struct {
	OrgID  int64                    `json:"orgId"`
	Alerts apimodels.PostableAlerts `json:"alerts"`
}

type alertBroadcast struct {
	logger log.Logger
	moa    *MultiOrgAlertmanager

	mu                sync.Mutex
	queue             chan AlertBroadcastPayload
	running           bool
	lastDropWarning   time.Time
	dropsSinceWarning int64
}

func newAlertBroadcastState(logger log.Logger, moa *MultiOrgAlertmanager) *alertBroadcast {
	queueSize := setting.AlertBroadcastDefaultQueueSize
	if moa != nil && moa.settings != nil && moa.settings.UnifiedAlerting.HASingleEvaluationAlertBroadcastQueueSize > 0 {
		queueSize = moa.settings.UnifiedAlerting.HASingleEvaluationAlertBroadcastQueueSize
	}

	return &alertBroadcast{
		logger: logger,
		moa:    moa,
		queue:  make(chan AlertBroadcastPayload, queueSize),
	}
}

func (s *alertBroadcast) MarshalBinary() ([]byte, error) {
	return nil, nil
}

func (s *alertBroadcast) Merge(b []byte) error {
	if len(b) == 0 {
		return nil
	}

	var payload AlertBroadcastPayload
	if err := json.Unmarshal(b, &payload); err != nil {
		s.logger.Warn("Failed to decode broadcast alerts payload", "error", err)
		return nil
	}
	if len(payload.Alerts.PostableAlerts) == 0 {
		return nil
	}

	// Merge is invoked from the cluster's receive path. Never call PutAlerts here:
	// it can block on Alertmanager backpressure and stall the gossip event loop.
	s.mu.Lock()
	select {
	case s.queue <- payload:
		if s.running {
			s.mu.Unlock()
			return nil
		}
		s.running = true
		s.mu.Unlock()
		go s.processQueue()
		return nil
	default:
		// Alert broadcasts are best-effort state replication. Dropping here is
		// preferable to blocking the cluster receive path; the next evaluation
		// will broadcast the current alert state again.
		dropped, shouldLog := s.shouldLogQueueDrop(time.Now())
		s.mu.Unlock()
		if shouldLog {
			// Logging can block on I/O. Keep it off the gossip receive path; the
			// rate limit bounds how often a warning can be scheduled.
			go s.logger.Warn("Dropping broadcast alerts because local processing queue is full", "orgID", payload.OrgID, "alerts", len(payload.Alerts.PostableAlerts), "droppedSinceLastWarning", dropped)
		}
		return nil
	}
}


 // shouldLogQueueDrop coalesces queue-overflow warnings on the gossip receive
 // path. Every dropped payload is counted, but warning I/O is limited to one
 // message per interval so sustained overload cannot stall gossip processing.
 func (s *alertBroadcast) shouldLogQueueDrop(now time.Time) (int64, bool) {
 	s.dropsSinceWarning++
 	if !s.lastDropWarning.IsZero() && now.Sub(s.lastDropWarning) < alertBroadcastDropLogInterval {
 		return 0, false
 	}
 	dropped := s.dropsSinceWarning
 	s.dropsSinceWarning = 0
 	s.lastDropWarning = now
 	return dropped, true
 }

func (s *alertBroadcast) processQueue() {
	for {
		select {
		case payload := <-s.queue:
			s.process(payload)
		default:
			s.mu.Lock()
			if len(s.queue) == 0 {
				s.running = false
				s.mu.Unlock()
				return
			}
			s.mu.Unlock()
		}
	}
}

func (s *alertBroadcast) process(payload AlertBroadcastPayload) {
	am, err := s.moa.AlertmanagerFor(payload.OrgID)
	if err != nil {
		if errors.Is(err, ErrNoAlertmanagerForOrg) || errors.Is(err, ErrAlertmanagerNotReady) {
			s.logger.Debug("Skipping receiving of broadcasted alerts, alertmanager unavailable", "orgID", payload.OrgID, "error", err)
			return
		}
		s.logger.Warn("Failed to resolve alertmanager for broadcast alerts", "orgID", payload.OrgID, "error", err)
		return
	}

	if err := am.PutAlerts(context.Background(), payload.Alerts); err != nil {
		s.logger.Warn("Failed to accept received broadcast alerts", "orgID", payload.OrgID, "alerts", len(payload.Alerts.PostableAlerts), "error", err)
	} else {
		s.logger.Debug("Received broadcast alerts from peer", "orgID", payload.OrgID, "alerts", len(payload.Alerts.PostableAlerts))
	}
}

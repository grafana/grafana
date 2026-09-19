package notifier

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/setting"
)

const alertBroadcastKey = "alerts:broadcast"

type AlertBroadcastPayload struct {
	OrgID  int64                    `json:"orgId"`
	Alerts apimodels.PostableAlerts `json:"alerts"`
}

type alertBroadcast struct {
	logger log.Logger
	moa    *MultiOrgAlertmanager

	mu      sync.Mutex
	queue   chan AlertBroadcastPayload
	running bool
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
	defer s.mu.Unlock()

	select {
	case s.queue <- payload:
	default:
		// Alert broadcasts are best-effort state replication. Dropping here is
		// preferable to blocking the cluster receive path; the next evaluation
		// will broadcast the current alert state again.
		s.logger.Warn("Dropping broadcast alerts because local processing queue is full", "orgID", payload.OrgID, "alerts", len(payload.Alerts.PostableAlerts))
		return nil
	}

	if s.running {
		return nil
	}

	s.running = true
	go s.processQueue()
	return nil
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

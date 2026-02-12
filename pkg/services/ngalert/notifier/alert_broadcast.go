package notifier

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

const alertBroadcastKey = "alerts:broadcast"

type AlertBroadcastPayload struct {
	OrgID  int64                    `json:"orgId"`
	Alerts apimodels.PostableAlerts `json:"alerts"`
}

type alertBroadcast struct {
	logger log.Logger
	moa    *MultiOrgAlertmanager
}

func newAlertBroadcastState(logger log.Logger, moa *MultiOrgAlertmanager) *alertBroadcast {
	return &alertBroadcast{
		logger: logger,
		moa:    moa,
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

	am, err := s.moa.AlertmanagerFor(payload.OrgID)
	if err != nil {
		if errors.Is(err, ErrNoAlertmanagerForOrg) || errors.Is(err, ErrAlertmanagerNotReady) {
			s.logger.Debug("Skipping receiving of broadcasted alerts, alertmanager unavailable", "orgID", payload.OrgID, "error", err)
			return nil
		}
		s.logger.Warn("Failed to resolve alertmanager for broadcast alerts", "orgID", payload.OrgID, "error", err)
		return nil
	}

	if err := am.PutAlerts(context.Background(), payload.Alerts); err != nil {
		s.logger.Warn("Failed to accept received broadcast alerts", "orgID", payload.OrgID, "alerts", len(payload.Alerts.PostableAlerts), "error", err)
	} else {
		s.logger.Debug("Received broadcast alerts from peer", "orgID", payload.OrgID, "alerts", len(payload.Alerts.PostableAlerts))
	}
	return nil
}

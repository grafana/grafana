package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"sort"
	"time"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"

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

// MarshalBinary returns the active alerts of every org as a JSON array of
// AlertBroadcastPayload. memberlist exchanges it with a random peer on every
// push/pull round, so a peer that missed broadcasts, or that just started,
// converges within one ha_push_pull_interval instead of expiring the alerts
// and notifying them as resolved.
//
// Only the evaluating instance (peer position 0) publishes, and only with
// ha_single_node_evaluation: peers hold copies that may be stale, and a
// resolved copy wins the merge against a firing one. Resolved alerts are never
// included for the same reason. When every instance evaluates, peers already
// hold every alert and the state would be wasted traffic.
func (s *alertBroadcast) MarshalBinary() ([]byte, error) {
	if s.moa == nil || s.moa.peer == nil || s.moa.peer.Position() != 0 {
		return nil, nil
	}
	if s.moa.settings == nil || !s.moa.settings.UnifiedAlerting.HASingleNodeEvaluation {
		return nil, nil
	}
	payloads := s.activeAlerts(context.Background(), time.Now())
	if len(payloads) == 0 {
		return nil, nil
	}
	if s.moa.metrics != nil {
		n := 0
		for i := range payloads {
			n += len(payloads[i].Alerts.PostableAlerts)
		}
		s.moa.metrics.AlertBroadcastFullStateAlerts.Add(float64(n))
	}
	return json.Marshal(payloads)
}

// activeAlerts lists the active alerts of every ready Alertmanager, one
// payload per org, orgs sorted by id. Orgs that are not ready or fail to list
// are skipped so one org cannot block the state of the others.
func (s *alertBroadcast) activeAlerts(ctx context.Context, now time.Time) []AlertBroadcastPayload {
	// Never wait for the lock: memberlist calls MarshalBinary with the cluster
	// peer lock held, while SyncAlertmanagersForOrgs holds this lock for writing
	// and registers states, which needs the peer lock. The next push/pull round
	// repairs what this round skipped.
	if !s.moa.alertmanagersMtx.TryRLock() {
		s.logger.Debug("Skipping full state sync round, alertmanagers are being synchronized")
		if s.moa.metrics != nil {
			s.moa.metrics.AlertBroadcastFullStateSkipped.Inc()
		}
		return nil
	}
	ams := make(map[int64]Alertmanager, len(s.moa.alertmanagers))
	for orgID, am := range s.moa.alertmanagers {
		ams[orgID] = am
	}
	s.moa.alertmanagersMtx.RUnlock()

	orgIDs := make([]int64, 0, len(ams))
	for orgID := range ams {
		orgIDs = append(orgIDs, orgID)
	}
	sort.Slice(orgIDs, func(i, j int) bool { return orgIDs[i] < orgIDs[j] })

	payloads := make([]AlertBroadcastPayload, 0, len(orgIDs))
	for _, orgID := range orgIDs {
		am := ams[orgID]
		if !am.Ready() {
			continue
		}
		alerts, err := am.GetAlerts(ctx, true, true, true, nil, "")
		if err != nil {
			s.logger.Warn("Failed to list alerts for full state sync", "orgID", orgID, "error", err)
			continue
		}
		postable := postableAlertsFromGettable(alerts, now)
		if len(postable.PostableAlerts) == 0 {
			continue
		}
		payloads = append(payloads, AlertBroadcastPayload{OrgID: orgID, Alerts: postable})
	}
	return payloads
}

// postableAlertsFromGettable converts alerts listed by the Alertmanager into
// the postable form used by both broadcast and full state sync. Alerts without
// an end time or already ended are dropped: pushing a resolved copy to a peer
// would resolve the alert there.
func postableAlertsFromGettable(alerts apimodels.GettableAlerts, now time.Time) apimodels.PostableAlerts {
	out := apimodels.PostableAlerts{PostableAlerts: make([]amv2.PostableAlert, 0, len(alerts))}
	for _, a := range alerts {
		if a == nil || a.EndsAt == nil || !time.Time(*a.EndsAt).After(now) {
			continue
		}
		pa := amv2.PostableAlert{
			Alert:       amv2.Alert{Labels: a.Labels, GeneratorURL: a.GeneratorURL},
			Annotations: a.Annotations,
			EndsAt:      *a.EndsAt,
		}
		if a.StartsAt != nil {
			pa.StartsAt = *a.StartsAt
		}
		out.PostableAlerts = append(out.PostableAlerts, pa)
	}
	return out
}

// Merge accepts either a single AlertBroadcastPayload (a broadcast from the
// evaluating instance) or a JSON array of them (full state from push/pull).
func (s *alertBroadcast) Merge(b []byte) error {
	b = bytes.TrimSpace(b)
	if len(b) == 0 {
		return nil
	}

	if b[0] == '[' {
		var payloads []AlertBroadcastPayload
		if err := json.Unmarshal(b, &payloads); err != nil {
			s.logger.Warn("Failed to decode full state alerts payload", "error", err)
			return nil
		}
		for i := range payloads {
			s.mergePayload(payloads[i], false)
		}
		return nil
	}

	var payload AlertBroadcastPayload
	if err := json.Unmarshal(b, &payload); err != nil {
		s.logger.Warn("Failed to decode broadcast alerts payload", "error", err)
		return nil
	}
	s.mergePayload(payload, true)
	return nil
}

// errAlertmanagersBusy is returned by a non-blocking lookup while the
// Alertmanagers are being synchronized.
var errAlertmanagersBusy = errors.New("alertmanagers are being synchronized")

// alertmanagerFor behaves like MultiOrgAlertmanager.AlertmanagerFor. When
// blocking is false it gives up instead of waiting for alertmanagersMtx, see
// activeAlerts for why the full state path must not wait.
func (s *alertBroadcast) alertmanagerFor(orgID int64, blocking bool) (Alertmanager, error) {
	if blocking {
		return s.moa.AlertmanagerFor(orgID)
	}
	if !s.moa.alertmanagersMtx.TryRLock() {
		return nil, errAlertmanagersBusy
	}
	defer s.moa.alertmanagersMtx.RUnlock()

	am, ok := s.moa.alertmanagers[orgID]
	if !ok {
		return nil, ErrNoAlertmanagerForOrg
	}
	if !am.Ready() {
		return am, ErrAlertmanagerNotReady
	}
	return am, nil
}

func (s *alertBroadcast) mergePayload(payload AlertBroadcastPayload, blocking bool) {
	if len(payload.Alerts.PostableAlerts) == 0 {
		return
	}

	am, err := s.alertmanagerFor(payload.OrgID, blocking)
	if err != nil {
		if errors.Is(err, ErrNoAlertmanagerForOrg) || errors.Is(err, ErrAlertmanagerNotReady) || errors.Is(err, errAlertmanagersBusy) {
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

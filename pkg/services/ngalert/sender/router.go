package sender

import (
	"context"
	"errors"
	"net/url"
	"sync"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

// AlertsRouter handles alerts generated during alert rule evaluation.
// Based on rule's orgID and the configuration for that organization,
// it determines whether an alert needs to be sent to an external Alertmanager and\or internal notifier.Alertmanager
//
// After creating a AlertsRouter, you must call Run to keep the AlertsRouter's
// state synchronized with the alerting configuration.
type AlertsRouter struct {
	logger           log.Logger
	clock            clock.Clock
	adminConfigStore store.AdminConfigurationStore

	// externalAlertmanagers help us send alerts to external Alertmanagers.
	adminConfigMtx               sync.RWMutex
	sendAlertsTo                 map[int64]models.AlertmanagersChoice
	externalAlertmanagers        map[int64]*ExternalAlertmanager
	externalAlertmanagersCfgHash map[int64]string

	multiOrgNotifier *notifier.MultiOrgAlertmanager

	appURL                  *url.URL
	disabledOrgs            map[int64]struct{}
	adminConfigPollInterval time.Duration
}

func NewAlertsRouter(multiOrgNotifier *notifier.MultiOrgAlertmanager, store store.AdminConfigurationStore, clk clock.Clock, appURL *url.URL, disabledOrgs map[int64]struct{}, configPollInterval time.Duration) *AlertsRouter {
	d := &AlertsRouter{
		logger:           log.New("alerts-router"),
		clock:            clk,
		adminConfigStore: store,

		adminConfigMtx:               sync.RWMutex{},
		externalAlertmanagers:        map[int64]*ExternalAlertmanager{},
		externalAlertmanagersCfgHash: map[int64]string{},
		sendAlertsTo:                 map[int64]models.AlertmanagersChoice{},

		multiOrgNotifier: multiOrgNotifier,

		appURL:                  appURL,
		disabledOrgs:            disabledOrgs,
		adminConfigPollInterval: configPollInterval,
	}
	return d
}

// SyncAndApplyConfigFromDatabase looks for the admin configuration in the database
// and adjusts the sender(s) and alert handling mechanism accordingly.
func (d *AlertsRouter) SyncAndApplyConfigFromDatabase() error {
	d.logger.Debug("start of admin configuration sync")
	cfgs, err := d.adminConfigStore.GetAdminConfigurations()
	if err != nil {
		return err
	}

	d.logger.Debug("found admin configurations", "count", len(cfgs))

	orgsFound := make(map[int64]struct{}, len(cfgs))
	d.adminConfigMtx.Lock()
	for _, cfg := range cfgs {
		_, isDisabledOrg := d.disabledOrgs[cfg.OrgID]
		if isDisabledOrg {
			d.logger.Debug("skipping starting sender for disabled org", "org", cfg.OrgID)
			continue
		}

		// Update the Alertmanagers choice for the organization.
		d.sendAlertsTo[cfg.OrgID] = cfg.SendAlertsTo

		orgsFound[cfg.OrgID] = struct{}{} // keep track of the which externalAlertmanagers we need to keep.

		existing, ok := d.externalAlertmanagers[cfg.OrgID]

		// We have no running sender and no Alertmanager(s) configured, no-op.
		if !ok && len(cfg.Alertmanagers) == 0 {
			d.logger.Debug("no external alertmanagers configured", "org", cfg.OrgID)
			continue
		}
		//  We have no running sender and alerts are handled internally, no-op.
		if !ok && cfg.SendAlertsTo == models.InternalAlertmanager {
			d.logger.Debug("alerts are handled internally", "org", cfg.OrgID)
			continue
		}

		// We have a running sender but no Alertmanager(s) configured, shut it down.
		if ok && len(cfg.Alertmanagers) == 0 {
			d.logger.Debug("no external alertmanager(s) configured, sender will be stopped", "org", cfg.OrgID)
			delete(orgsFound, cfg.OrgID)
			continue
		}

		// We have a running sender, check if we need to apply a new config.
		if ok {
			if d.externalAlertmanagersCfgHash[cfg.OrgID] == cfg.AsSHA256() {
				d.logger.Debug("sender configuration is the same as the one running, no-op", "org", cfg.OrgID, "alertmanagers", cfg.Alertmanagers)
				continue
			}

			d.logger.Debug("applying new configuration to sender", "org", cfg.OrgID, "alertmanagers", cfg.Alertmanagers)
			err := existing.ApplyConfig(cfg)
			if err != nil {
				d.logger.Error("failed to apply configuration", "err", err, "org", cfg.OrgID)
				continue
			}
			d.externalAlertmanagersCfgHash[cfg.OrgID] = cfg.AsSHA256()
			continue
		}

		// No sender and have Alertmanager(s) to send to - start a new one.
		d.logger.Info("creating new sender for the external alertmanagers", "org", cfg.OrgID, "alertmanagers", cfg.Alertmanagers)
		s, err := NewExternalAlertmanagerSender()
		if err != nil {
			d.logger.Error("unable to start the sender", "err", err, "org", cfg.OrgID)
			continue
		}

		d.externalAlertmanagers[cfg.OrgID] = s
		s.Run()

		err = s.ApplyConfig(cfg)
		if err != nil {
			d.logger.Error("failed to apply configuration", "err", err, "org", cfg.OrgID)
			continue
		}

		d.externalAlertmanagersCfgHash[cfg.OrgID] = cfg.AsSHA256()
	}

	sendersToStop := map[int64]*ExternalAlertmanager{}

	for orgID, s := range d.externalAlertmanagers {
		if _, exists := orgsFound[orgID]; !exists {
			sendersToStop[orgID] = s
			delete(d.externalAlertmanagers, orgID)
			delete(d.externalAlertmanagersCfgHash, orgID)
		}
	}
	d.adminConfigMtx.Unlock()

	// We can now stop these externalAlertmanagers w/o having to hold a lock.
	for orgID, s := range sendersToStop {
		d.logger.Info("stopping sender", "org", orgID)
		s.Stop()
		d.logger.Info("stopped sender", "org", orgID)
	}

	d.logger.Debug("finish of admin configuration sync")

	return nil
}

func (d *AlertsRouter) Send(key models.AlertRuleKey, alerts definitions.PostableAlerts) {
	logger := d.logger.New("rule_uid", key.UID, "org", key.OrgID)
	if len(alerts.PostableAlerts) == 0 {
		logger.Debug("no alerts to notify about")
		return
	}
	// Send alerts to local notifier if they need to be handled internally
	// or if no external AMs have been discovered yet.
	var localNotifierExist, externalNotifierExist bool
	if d.sendAlertsTo[key.OrgID] == models.ExternalAlertmanagers && len(d.AlertmanagersFor(key.OrgID)) > 0 {
		logger.Debug("no alerts to put in the notifier")
	} else {
		logger.Debug("sending alerts to local notifier", "count", len(alerts.PostableAlerts), "alerts", alerts.PostableAlerts)
		n, err := d.multiOrgNotifier.AlertmanagerFor(key.OrgID)
		if err == nil {
			localNotifierExist = true
			if err := n.PutAlerts(alerts); err != nil {
				logger.Error("failed to put alerts in the local notifier", "count", len(alerts.PostableAlerts), "err", err)
			}
		} else {
			if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
				logger.Debug("local notifier was not found")
			} else {
				logger.Error("local notifier is not available", "err", err)
			}
		}
	}

	// Send alerts to external Alertmanager(s) if we have a sender for this organization
	// and alerts are not being handled just internally.
	d.adminConfigMtx.RLock()
	defer d.adminConfigMtx.RUnlock()
	s, ok := d.externalAlertmanagers[key.OrgID]
	if ok && d.sendAlertsTo[key.OrgID] != models.InternalAlertmanager {
		logger.Debug("sending alerts to external notifier", "count", len(alerts.PostableAlerts), "alerts", alerts.PostableAlerts)
		s.SendAlerts(alerts)
		externalNotifierExist = true
	}

	if !localNotifierExist && !externalNotifierExist {
		logger.Error("no external or internal notifier - [%d] alerts not delivered", len(alerts.PostableAlerts))
	}
}

// AlertmanagersFor returns all the discovered Alertmanager(s) for a particular organization.
func (d *AlertsRouter) AlertmanagersFor(orgID int64) []*url.URL {
	d.adminConfigMtx.RLock()
	defer d.adminConfigMtx.RUnlock()
	s, ok := d.externalAlertmanagers[orgID]
	if !ok {
		return []*url.URL{}
	}
	return s.Alertmanagers()
}

// DroppedAlertmanagersFor returns all the dropped Alertmanager(s) for a particular organization.
func (d *AlertsRouter) DroppedAlertmanagersFor(orgID int64) []*url.URL {
	d.adminConfigMtx.RLock()
	defer d.adminConfigMtx.RUnlock()
	s, ok := d.externalAlertmanagers[orgID]
	if !ok {
		return []*url.URL{}
	}

	return s.DroppedAlertmanagers()
}

// Run starts regular updates of the configuration.
func (d *AlertsRouter) Run(ctx context.Context) error {
	for {
		select {
		case <-time.After(d.adminConfigPollInterval):
			if err := d.SyncAndApplyConfigFromDatabase(); err != nil {
				d.logger.Error("unable to sync admin configuration", "err", err)
			}
		case <-ctx.Done():
			// Stop sending alerts to all external Alertmanager(s).
			d.adminConfigMtx.Lock()
			for orgID, s := range d.externalAlertmanagers {
				delete(d.externalAlertmanagers, orgID) // delete before we stop to make sure we don't accept any more alerts.
				s.Stop()
			}
			d.adminConfigMtx.Unlock()

			return nil
		}
	}
}

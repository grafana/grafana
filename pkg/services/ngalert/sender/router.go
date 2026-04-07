package sender

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/url"
	"path"
	"sort"
	"sync"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
)

// alertmanagerKey identifies a sender by org and datasource.
type alertmanagerKey struct {
	orgID         int64
	datasourceUID string
}

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
	// Each (org, datasource) pair has its own sender.
	adminConfigMtx               sync.RWMutex
	sendAlertsTo                 map[int64]models.AlertmanagersChoice
	externalAlertmanagers        map[alertmanagerKey]*ExternalAlertmanager
	externalAlertmanagersCfgHash map[alertmanagerKey]string

	multiOrgNotifier *notifier.MultiOrgAlertmanager

	appURL                  *url.URL
	disabledOrgs            map[int64]struct{}
	adminConfigPollInterval time.Duration

	datasourceService datasources.DataSourceService
	secretService     secrets.Service
	featureManager    featuremgmt.FeatureToggles
	broadcastAlerts   bool
	senderMetrics     *metrics.Sender
}

func NewAlertsRouter(multiOrgNotifier *notifier.MultiOrgAlertmanager, store store.AdminConfigurationStore,
	clk clock.Clock, appURL *url.URL, disabledOrgs map[int64]struct{}, configPollInterval time.Duration,
	datasourceService datasources.DataSourceService, secretService secrets.Service, featureManager featuremgmt.FeatureToggles,
	broadcastAlerts bool, senderMetrics *metrics.Sender) *AlertsRouter {
	d := &AlertsRouter{
		logger:           log.New("ngalert.sender.router"),
		clock:            clk,
		adminConfigStore: store,

		adminConfigMtx:               sync.RWMutex{},
		externalAlertmanagers:        map[alertmanagerKey]*ExternalAlertmanager{},
		externalAlertmanagersCfgHash: map[alertmanagerKey]string{},
		sendAlertsTo:                 map[int64]models.AlertmanagersChoice{},

		multiOrgNotifier: multiOrgNotifier,

		appURL:                  appURL,
		disabledOrgs:            disabledOrgs,
		adminConfigPollInterval: configPollInterval,

		datasourceService: datasourceService,
		secretService:     secretService,
		featureManager:    featureManager,
		broadcastAlerts:   broadcastAlerts,
		senderMetrics:     senderMetrics,
	}
	return d
}

// SyncAndApplyConfigFromDatabase looks for the admin configuration in the database
// and adjusts the sender(s) and alert handling mechanism accordingly.
func (d *AlertsRouter) SyncAndApplyConfigFromDatabase(ctx context.Context) error {
	cfgs, err := d.adminConfigStore.GetAdminConfigurations()
	if err != nil {
		return err
	}

	d.logger.Debug("Attempting to sync admin configs", "count", len(cfgs))

	//nolint:staticcheck // not yet migrated to OpenFeature
	disableExternal := d.featureManager.IsEnabled(ctx, featuremgmt.FlagAlertingDisableSendAlertsExternal)
	keysFound := make(map[alertmanagerKey]struct{})

	// We're holding this lock either until we return an error or right before we stop the senders.
	d.adminConfigMtx.Lock()

	for _, cfg := range cfgs {
		_, isDisabledOrg := d.disabledOrgs[cfg.OrgID]
		if isDisabledOrg {
			continue
		}

		var sendAlertsTo models.AlertmanagersChoice
		if cfg.SendAlertsTo != nil {
			sendAlertsTo = *cfg.SendAlertsTo
		}

		if disableExternal && sendAlertsTo != models.InternalAlertmanager {
			d.logger.Warn("Alertmanager choice in configuration will be ignored due to feature flags", "org", cfg.OrgID, "choice", sendAlertsTo)
			sendAlertsTo = models.InternalAlertmanager
		}

		// Update the Alertmanagers choice for the organization.
		d.sendAlertsTo[cfg.OrgID] = sendAlertsTo

		//  Alerts are handled internally, no-op.
		if sendAlertsTo == models.InternalAlertmanager {
			d.logger.Debug("Grafana is configured to send alerts to the internal alertmanager only. Skipping synchronization with external alertmanager", "org", cfg.OrgID)
			continue
		}

		alertmanagers, err := d.alertmanagersFromDatasources(cfg.OrgID)
		if err != nil {
			d.logger.Error("Failed to get alertmanagers from datasources", "org", cfg.OrgID, "error", err)
			continue
		}

		if len(alertmanagers) == 0 {
			d.logger.Debug("No external alertmanagers configured", "org", cfg.OrgID)
			continue
		}

		// Process each datasource independently — one sender per datasource.
		for _, am := range alertmanagers {
			key := alertmanagerKey{orgID: cfg.OrgID, datasourceUID: am.DatasourceUID}
			keysFound[key] = struct{}{}

			amHash := am.SHA256()

			existing, ok := d.externalAlertmanagers[key]

			// We have a running sender, check if we need to apply a new config.
			if ok {
				if d.externalAlertmanagersCfgHash[key] == amHash {
					d.logger.Debug("Sender configuration is the same as the one running, no-op", "org", cfg.OrgID, "datasource_uid", am.DatasourceUID)
					continue
				}

				d.logger.Info("Applying new configuration to sender", "org", cfg.OrgID, "datasource_uid", am.DatasourceUID, "cfg", cfg.ID)
				err := existing.ApplyConfig(cfg.OrgID, cfg.ID, []ExternalAMcfg{am})
				if err != nil {
					d.logger.Error("Failed to apply configuration", "error", err, "org", cfg.OrgID, "datasource_uid", am.DatasourceUID)
					continue
				}
				d.externalAlertmanagersCfgHash[key] = amHash
				continue
			}

			// No sender — start a new one for this datasource.
			d.logger.Info("Creating new sender for external alertmanager", "org", cfg.OrgID, "datasource_uid", am.DatasourceUID)
			senderLogger := log.New("ngalert.sender.external-alertmanager")
			var reg prometheus.Registerer
			if d.senderMetrics != nil {
				reg = d.senderMetrics.GetOrCreateRegistry(cfg.OrgID, am.DatasourceUID)
			} else {
				reg = prometheus.NewRegistry()
			}
			s, err := NewExternalAlertmanagerSender(senderLogger, reg)
			if err != nil {
				d.adminConfigMtx.Unlock()
				return err
			}
			d.externalAlertmanagers[key] = s
			s.Run()

			err = s.ApplyConfig(cfg.OrgID, cfg.ID, []ExternalAMcfg{am})
			if err != nil {
				d.logger.Error("Failed to apply configuration", "error", err, "org", cfg.OrgID, "datasource_uid", am.DatasourceUID)
				continue
			}

			d.externalAlertmanagersCfgHash[key] = amHash
		}
	}

	sendersToStop := map[alertmanagerKey]*ExternalAlertmanager{}

	for key, s := range d.externalAlertmanagers {
		if _, exists := keysFound[key]; !exists {
			sendersToStop[key] = s
			delete(d.externalAlertmanagers, key)
			delete(d.externalAlertmanagersCfgHash, key)
		}
	}

	// We can now stop these senders w/o having to hold a lock.
	d.adminConfigMtx.Unlock()
	for key, s := range sendersToStop {
		d.logger.Info("Stopping sender", "org", key.orgID, "datasource_uid", key.datasourceUID)
		s.Stop()
		if d.senderMetrics != nil {
			d.senderMetrics.RemoveRegistry(key.orgID, key.datasourceUID)
		}
		d.logger.Info("Stopped sender", "org", key.orgID, "datasource_uid", key.datasourceUID)
	}

	d.logger.Debug("Finish of admin configuration sync")

	return nil
}

func buildRedactedAMs(l log.Logger, alertmanagers []ExternalAMcfg, ordId int64) []string {
	redactedAMs := make([]string, 0, len(alertmanagers))
	for _, am := range alertmanagers {
		parsedAM, err := url.Parse(am.URL)
		if err != nil {
			l.Error("Failed to parse alertmanager string", "org", ordId, "error", err)
			continue
		}

		redactedAMs = append(redactedAMs, parsedAM.Redacted())
	}

	return redactedAMs
}

func asSHA256(strings []string) string {
	h := sha256.New()
	sort.Strings(strings)
	_, _ = fmt.Fprintf(h, "%v", strings)
	return fmt.Sprintf("%x", h.Sum(nil))
}

func (d *AlertsRouter) alertmanagersFromDatasources(orgID int64) ([]ExternalAMcfg, error) {
	// We might have alertmanager datasources that are acting as external
	// alertmanager, let's fetch them.
	query := &datasources.GetDataSourcesByTypeQuery{
		OrgID: orgID,
		Type:  datasources.DS_ALERTMANAGER,
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()
	dataSources, err := d.datasourceService.GetDataSourcesByType(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch datasources for org: %w", err)
	}

	alertmanagers := make([]ExternalAMcfg, 0, len(dataSources))

	for _, ds := range dataSources {
		if !ds.JsonData.Get(definitions.HandleGrafanaManagedAlerts).MustBool(false) {
			continue
		}

		cfg, err := d.datasourceToExternalAMcfg(ds)
		if err != nil {
			d.logger.Error("Failed to convert datasource to external alertmanager config",
				"org", ds.OrgID,
				"uid", ds.UID,
				"error", err)
			continue
		}

		alertmanagers = append(alertmanagers, cfg)
	}

	return alertmanagers, nil
}

// datasourceToExternalAMcfg converts a datasource to an ExternalAMcfg.
func (d *AlertsRouter) datasourceToExternalAMcfg(ds *datasources.DataSource) (ExternalAMcfg, error) {
	amURL, err := d.buildExternalURL(ds)
	if err != nil {
		return ExternalAMcfg{}, fmt.Errorf("failed to build external alertmanager URL: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	headers, err := d.datasourceService.CustomHeaders(ctx, ds)
	cancel()
	if err != nil {
		return ExternalAMcfg{}, fmt.Errorf("failed to get custom headers: %w", err)
	}

	insecureSkipVerify := false

	var tlsAuthEnabled bool
	if ds.JsonData != nil {
		insecureSkipVerify = ds.JsonData.Get("tlsSkipVerify").MustBool(false)
		tlsAuthEnabled = ds.JsonData.Get("tlsAuth").MustBool(false)
	}

	var tlsClientCert, tlsClientKey string
	if tlsAuthEnabled {
		if ds.SecureJsonData == nil {
			return ExternalAMcfg{}, errors.New("tlsAuth is enabled but TLS client certificate and key are not configured")
		}

		tlsClientKey = d.secretService.GetDecryptedValue(context.Background(), ds.SecureJsonData, "tlsClientKey", "")
		tlsClientCert = d.secretService.GetDecryptedValue(context.Background(), ds.SecureJsonData, "tlsClientCert", "")

		if tlsClientCert == "" || tlsClientKey == "" {
			return ExternalAMcfg{}, errors.New("tlsAuth is enabled but TLS client certificate or key is empty")
		}
	}

	return ExternalAMcfg{
		URL:                amURL,
		Headers:            headers,
		InsecureSkipVerify: insecureSkipVerify,
		TLSClientCert:      tlsClientCert,
		TLSClientKey:       tlsClientKey,
		DatasourceUID:      ds.UID,
	}, nil
}

func (d *AlertsRouter) buildExternalURL(ds *datasources.DataSource) (string, error) {
	// We re-use the same parsing logic as the datasource to make sure it matches whatever output the user received
	// when doing the healthcheck.
	parsed, err := datasource.ValidateURL(datasources.DS_ALERTMANAGER, ds.URL)
	if err != nil {
		return "", fmt.Errorf("failed to parse alertmanager datasource url: %w", err)
	}

	// If this is a Mimir or Cortex implementation, the Alert API is under a different path than config API
	if ds.JsonData != nil {
		impl := ds.JsonData.Get("implementation").MustString("")
		switch impl {
		case "mimir", "cortex":
			if parsed.Path == "" {
				parsed.Path = "/"
			}
			lastSegment := path.Base(parsed.Path)
			if lastSegment != "alertmanager" {
				parsed = parsed.JoinPath("/alertmanager")
			}
		default:
		}
	}

	// If basic auth is enabled we need to build the url with basic auth baked in.
	if ds.BasicAuth {
		password := d.secretService.GetDecryptedValue(context.Background(), ds.SecureJsonData, "basicAuthPassword", "")
		if password == "" {
			return "", fmt.Errorf("basic auth enabled but no password set")
		}
		parsed.User = url.UserPassword(ds.BasicAuthUser, password)
	}

	return parsed.String(), nil
}

func (d *AlertsRouter) Send(ctx context.Context, key models.AlertRuleKey, alerts definitions.PostableAlerts) {
	logger := d.logger.New(key.LogContext()...)
	if len(alerts.PostableAlerts) == 0 {
		logger.Info("No alerts to notify about")
		return
	}
	// Send alerts to local notifier if they need to be handled internally
	// or if no external AMs have been discovered yet.
	d.adminConfigMtx.RLock()
	defer d.adminConfigMtx.RUnlock()
	var localNotifierExist, externalNotifierExist bool
	if d.sendAlertsTo[key.OrgID] == models.ExternalAlertmanagers && len(d.alertmanagersFor(key.OrgID)) > 0 {
		logger.Debug("All alerts for the given org should be routed to external notifiers only. skipping the internal notifier.")
	} else {
		logger.Info("Sending alerts to local notifier", "count", len(alerts.PostableAlerts))
		n, err := d.multiOrgNotifier.AlertmanagerFor(key.OrgID)
		if err == nil {
			localNotifierExist = true
			if err := n.PutAlerts(ctx, alerts); err != nil {
				logger.Error("Failed to put alerts in the local notifier", "count", len(alerts.PostableAlerts), "error", err)
			}
			if d.broadcastAlerts {
				d.multiOrgNotifier.BroadcastAlerts(key.OrgID, alerts)
			}
		} else {
			if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
				logger.Debug("Local notifier was not found")
			} else {
				logger.Error("Local notifier is not available", "error", err)
			}
		}
	}

	// Send alerts to external Alertmanager(s) if we have senders for this organization
	// and alerts are not being handled just internally.
	if d.sendAlertsTo[key.OrgID] != models.InternalAlertmanager {
		for amKey, s := range d.externalAlertmanagers {
			if amKey.orgID == key.OrgID {
				logger.Info("Sending alerts to external notifier", "count", len(alerts.PostableAlerts), "datasource_uid", amKey.datasourceUID)
				s.SendAlerts(alerts)
				externalNotifierExist = true
			}
		}
	}

	if !localNotifierExist && !externalNotifierExist {
		logger.Error("No external or internal notifier - alerts not delivered", "count", len(alerts.PostableAlerts))
	}
}

// AlertmanagersFor returns all the discovered Alertmanager(s) for a particular organization.
func (d *AlertsRouter) AlertmanagersFor(orgID int64) []*url.URL {
	d.adminConfigMtx.RLock()
	defer d.adminConfigMtx.RUnlock()
	return d.alertmanagersFor(orgID)
}

func (d *AlertsRouter) alertmanagersFor(orgID int64) []*url.URL {
	var urls []*url.URL
	for key, s := range d.externalAlertmanagers {
		if key.orgID == orgID {
			urls = append(urls, s.Alertmanagers()...)
		}
	}
	if urls == nil {
		return []*url.URL{}
	}
	return urls
}

// DroppedAlertmanagersFor returns all the dropped Alertmanager(s) for a particular organization.
func (d *AlertsRouter) DroppedAlertmanagersFor(orgID int64) []*url.URL {
	d.adminConfigMtx.RLock()
	defer d.adminConfigMtx.RUnlock()
	var urls []*url.URL
	for key, s := range d.externalAlertmanagers {
		if key.orgID == orgID {
			urls = append(urls, s.DroppedAlertmanagers()...)
		}
	}
	if urls == nil {
		return []*url.URL{}
	}
	return urls
}

// Run starts regular updates of the configuration.
func (d *AlertsRouter) Run(ctx context.Context) error {
	for {
		select {
		case <-time.After(d.adminConfigPollInterval):
			if err := d.SyncAndApplyConfigFromDatabase(ctx); err != nil {
				d.logger.Error("Unable to sync admin configuration", "error", err)
			}
		case <-ctx.Done():
			// Stop sending alerts to all external Alertmanager(s).
			d.adminConfigMtx.Lock()
			for key, s := range d.externalAlertmanagers {
				delete(d.externalAlertmanagers, key) // delete before we stop to make sure we don't accept any more alerts.
				s.Stop()
				if d.senderMetrics != nil {
					d.senderMetrics.RemoveRegistry(key.orgID, key.datasourceUID)
				}
			}
			d.adminConfigMtx.Unlock()

			return nil
		}
	}
}

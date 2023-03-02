package notifier

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strconv"
	"time"

	"github.com/grafana/alerting/alerting"
	"github.com/grafana/alerting/alerting/notifier/channels"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	notificationLogFilename = "notifications"
	silencesFilename        = "silences"

	workingDir = "alerting"
	// maintenanceNotificationAndSilences how often should we flush and garbage collect notifications
	notificationLogMaintenanceInterval = 15 * time.Minute
)

// How long should we keep silences and notification entries on-disk after they've served their purpose.
var retentionNotificationsAndSilences = 5 * 24 * time.Hour
var silenceMaintenanceInterval = 15 * time.Minute

type AlertingStore interface {
	store.AlertingStore
	store.ImageStore
}

type Alertmanager struct {
	Base   *alerting.GrafanaAlertmanager
	logger log.Logger

	Settings            *setting.Cfg
	Store               AlertingStore
	fileStore           *FileStore
	NotificationService notifications.Service

	decryptFn channels.GetDecryptedValueFn
	orgID     int64
}

// maintenanceOptions represent the options for components that need maintenance on a frequency within the Alertmanager.
// It implements the alerting.MaintenanceOptions interface.
type maintenanceOptions struct {
	filepath             string
	retention            time.Duration
	maintenanceFrequency time.Duration
	maintenanceFunc      func(alerting.State) (int64, error)
}

func (m maintenanceOptions) Filepath() string {
	return m.filepath
}

func (m maintenanceOptions) Retention() time.Duration {
	return m.retention
}

func (m maintenanceOptions) MaintenanceFrequency() time.Duration {
	return m.maintenanceFrequency
}

func (m maintenanceOptions) MaintenanceFunc(state alerting.State) (int64, error) {
	return m.maintenanceFunc(state)
}

func newAlertmanager(ctx context.Context, orgID int64, cfg *setting.Cfg, store AlertingStore, kvStore kvstore.KVStore,
	peer alerting.ClusterPeer, decryptFn channels.GetDecryptedValueFn, ns notifications.Service,
	m *metrics.Alertmanager) (*Alertmanager, error) {
	workingPath := filepath.Join(cfg.DataPath, workingDir, strconv.Itoa(int(orgID)))
	fileStore := NewFileStore(orgID, kvStore, workingPath)

	nflogFilepath, err := fileStore.FilepathFor(ctx, notificationLogFilename)
	if err != nil {
		return nil, err
	}
	silencesFilePath, err := fileStore.FilepathFor(ctx, silencesFilename)
	if err != nil {
		return nil, err
	}

	silencesOptions := maintenanceOptions{
		filepath:             silencesFilePath,
		retention:            retentionNotificationsAndSilences,
		maintenanceFrequency: silenceMaintenanceInterval,
		maintenanceFunc: func(state alerting.State) (int64, error) {
			// Detached context here is to make sure that when the service is shut down the persist operation is executed.
			return fileStore.Persist(context.Background(), silencesFilename, state)
		},
	}

	nflogOptions := maintenanceOptions{
		filepath:             nflogFilepath,
		retention:            retentionNotificationsAndSilences,
		maintenanceFrequency: notificationLogMaintenanceInterval,
		maintenanceFunc: func(state alerting.State) (int64, error) {
			// Detached context here is to make sure that when the service is shut down the persist operation is executed.
			return fileStore.Persist(context.Background(), notificationLogFilename, state)
		},
	}

	amcfg := &alerting.GrafanaAlertmanagerConfig{
		WorkingDirectory:   workingDir,
		AlertStoreCallback: nil,
		PeerTimeout:        cfg.UnifiedAlerting.HAPeerTimeout,
		Silences:           silencesOptions,
		Nflog:              nflogOptions,
	}

	l := log.New("alertmanager", "org", orgID)
	gam, err := alerting.NewGrafanaAlertmanager("orgID", orgID, amcfg, peer, l, alerting.NewGrafanaAlertmanagerMetrics(m.Registerer))
	if err != nil {
		return nil, err
	}

	am := &Alertmanager{
		Base:                gam,
		Settings:            cfg,
		Store:               store,
		NotificationService: ns,
		orgID:               orgID,
		decryptFn:           decryptFn,
		fileStore:           fileStore,
		logger:              l,
	}

	return am, nil
}

func (am *Alertmanager) Ready() bool {
	// We consider AM as ready only when the config has been
	// applied at least once successfully. Until then, some objects
	// can still be nil.
	return am.Base.Ready()
}

func (am *Alertmanager) StopAndWait() {
	am.Base.StopAndWait()
}

// SaveAndApplyDefaultConfig saves the default configuration the database and applies the configuration to the Alertmanager.
// It rolls back the save if we fail to apply the configuration.
func (am *Alertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	var outerErr error
	am.Base.WithLock(func() {
		cmd := &ngmodels.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: am.Settings.UnifiedAlerting.DefaultConfiguration,
			Default:                   true,
			ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
			OrgID:                     am.orgID,
		}

		cfg, err := Load([]byte(am.Settings.UnifiedAlerting.DefaultConfiguration))
		if err != nil {
			outerErr = err
			return
		}

		err = am.Store.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func() error {
			if err := am.applyConfig(cfg, []byte(am.Settings.UnifiedAlerting.DefaultConfiguration)); err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			outerErr = nil
			return
		}
	})

	return outerErr
}

// SaveAndApplyConfig saves the configuration the database and applies the configuration to the Alertmanager.
// It rollbacks the save if we fail to apply the configuration.
func (am *Alertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	rawConfig, err := json.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to serialize to the Alertmanager configuration: %w", err)
	}

	var outerErr error
	am.Base.WithLock(func() {
		cmd := &ngmodels.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: string(rawConfig),
			ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
			OrgID:                     am.orgID,
		}

		err = am.Store.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func() error {
			if err := am.applyConfig(cfg, rawConfig); err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			outerErr = err
			return
		}
	})

	return outerErr
}

// ApplyConfig applies the configuration to the Alertmanager.
func (am *Alertmanager) ApplyConfig(dbCfg *ngmodels.AlertConfiguration) error {
	var err error
	cfg, err := Load([]byte(dbCfg.AlertmanagerConfiguration))
	if err != nil {
		return fmt.Errorf("failed to parse Alertmanager config: %w", err)
	}

	var outerErr error
	am.Base.WithLock(func() {
		if err = am.applyConfig(cfg, nil); err != nil {
			outerErr = fmt.Errorf("unable to apply configuration: %w", err)
			return
		}
	})

	return outerErr
}

// applyConfig applies a new configuration by re-initializing all components using the configuration provided.
// It is not safe to call concurrently.
func (am *Alertmanager) applyConfig(cfg *apimodels.PostableUserConfig, rawConfig []byte) (err error) {
	// First, let's make sure this config is not already loaded
	var configChanged bool
	if rawConfig == nil {
		enc, err := json.Marshal(cfg.AlertmanagerConfig)
		if err != nil {
			// In theory, this should never happen.
			return err
		}
		rawConfig = enc
	}

	if am.Base.ConfigHash() != md5.Sum(rawConfig) {
		configChanged = true
	}

	if cfg.TemplateFiles == nil {
		cfg.TemplateFiles = map[string]string{}
	}
	cfg.TemplateFiles["__default__.tmpl"] = channels.DefaultTemplateString

	// next, we need to make sure we persist the templates to disk.
	paths, templatesChanged, err := PersistTemplates(cfg, am.WorkingDirPath())
	if err != nil {
		return err
	}

	// If neither the configuration nor templates have changed, we've got nothing to do.
	if !configChanged && !templatesChanged {
		am.logger.Debug("neither config nor template have changed, skipping configuration sync.")
		return nil
	}

	// With the templates persisted, create the template list using the paths.
	tmpl, err := am.Base.TemplateFromPaths(am.Settings.AppURL, paths...)
	if err != nil {
		return err
	}

	err = am.Base.ApplyConfig(AlertingConfiguration{
		RawAlertmanagerConfig:    rawConfig,
		AlertmanagerConfig:       cfg.AlertmanagerConfig,
		AlertmanagerTemplates:    tmpl,
		IntegrationsFunc:         am.buildIntegrationsMap,
		ReceiverIntegrationsFunc: am.buildReceiverIntegration,
	})
	if err != nil {
		return err
	}

	return nil
}

func (am *Alertmanager) WorkingDirPath() string {
	return filepath.Join(am.Settings.DataPath, workingDir, strconv.Itoa(int(am.orgID)))
}

// buildIntegrationsMap builds a map of name to the list of Grafana integration notifiers off of a list of receiver config.
func (am *Alertmanager) buildIntegrationsMap(receivers []*apimodels.PostableApiReceiver, templates *alerting.Template) (map[string][]*alerting.Integration, error) {
	integrationsMap := make(map[string][]*alerting.Integration, len(receivers))
	for _, receiver := range receivers {
		integrations, err := am.buildReceiverIntegrations(receiver, templates)
		if err != nil {
			return nil, err
		}
		integrationsMap[receiver.Name] = integrations
	}

	return integrationsMap, nil
}

// buildReceiverIntegrations builds a list of integration notifiers off of a receiver config.
func (am *Alertmanager) buildReceiverIntegrations(receiver *apimodels.PostableApiReceiver, tmpl *alerting.Template) ([]*alerting.Integration, error) {
	integrations := make([]*alerting.Integration, 0, len(receiver.GrafanaManagedReceivers))
	for i, r := range receiver.GrafanaManagedReceivers {
		n, err := am.buildReceiverIntegration(r, tmpl)
		if err != nil {
			return nil, err
		}
		integrations = append(integrations, alerting.NewIntegration(n, n, r.Type, i))
	}
	return integrations, nil
}

func (am *Alertmanager) buildReceiverIntegration(r *apimodels.PostableGrafanaReceiver, tmpl *alerting.Template) (channels.NotificationChannel, error) {
	// secure settings are already encrypted at this point
	secureSettings := make(map[string][]byte, len(r.SecureSettings))

	for k, v := range r.SecureSettings {
		d, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			return nil, InvalidReceiverError{
				Receiver: r,
				Err:      errors.New("failed to decode secure setting"),
			}
		}
		secureSettings[k] = d
	}

	var (
		cfg = &channels.NotificationChannelConfig{
			UID:                   r.UID,
			OrgID:                 am.orgID,
			Name:                  r.Name,
			Type:                  r.Type,
			DisableResolveMessage: r.DisableResolveMessage,
			Settings:              json.RawMessage(r.Settings),
			SecureSettings:        secureSettings,
		}
	)
	factoryConfig, err := channels.NewFactoryConfig(cfg, NewNotificationSender(am.NotificationService), am.decryptFn, tmpl, newImageStore(am.Store), LoggerFactory, setting.BuildVersion)
	if err != nil {
		return nil, InvalidReceiverError{
			Receiver: r,
			Err:      err,
		}
	}
	receiverFactory, exists := channels_config.Factory(r.Type)
	if !exists {
		return nil, InvalidReceiverError{
			Receiver: r,
			Err:      fmt.Errorf("notifier %s is not supported", r.Type),
		}
	}
	n, err := receiverFactory(factoryConfig)
	if err != nil {
		return nil, InvalidReceiverError{
			Receiver: r,
			Err:      err,
		}
	}
	return n, nil
}

// PutAlerts receives the alerts and then sends them through the corresponding route based on whenever the alert has a receiver embedded or not
func (am *Alertmanager) PutAlerts(postableAlerts apimodels.PostableAlerts) error {
	alerts := make(alerting.PostableAlerts, 0, len(postableAlerts.PostableAlerts))
	for _, pa := range postableAlerts.PostableAlerts {
		alerts = append(alerts, &alerting.PostableAlert{
			Annotations: pa.Annotations,
			EndsAt:      pa.EndsAt,
			StartsAt:    pa.StartsAt,
			Alert:       pa.Alert,
		})
	}

	return am.Base.PutAlerts(alerts)
}

// AlertValidationError is the error capturing the validation errors
// faced on the alerts.
type AlertValidationError struct {
	Alerts []amv2.PostableAlert
	Errors []error // Errors[i] refers to Alerts[i].
}

func (e AlertValidationError) Error() string {
	errMsg := ""
	if len(e.Errors) != 0 {
		errMsg = e.Errors[0].Error()
		for _, e := range e.Errors[1:] {
			errMsg += ";" + e.Error()
		}
	}
	return errMsg
}

type nilLimits struct{}

func (n nilLimits) MaxNumberOfAggregationGroups() int { return 0 }

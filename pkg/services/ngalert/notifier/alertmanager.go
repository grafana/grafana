package notifier

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"time"
	"unicode/utf8"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/cluster"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/inhibit"
	"github.com/prometheus/alertmanager/nflog"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"

	pb "github.com/prometheus/alertmanager/silence/silencepb"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	notificationLogFilename = "notifications"
	silencesFilename        = "silences"

	workingDir = "alerting"
	// maintenanceNotificationAndSilences how often should we flush and gargabe collect notifications and silences
	maintenanceNotificationAndSilences = 15 * time.Minute
	// defaultResolveTimeout is the default timeout used for resolving an alert
	// if the end time is not specified.
	defaultResolveTimeout = 5 * time.Minute
	// memoryAlertsGCInterval is the interval at which we'll remove resolved alerts from memory.
	memoryAlertsGCInterval = 30 * time.Minute
)

// How long should we keep silences and notification entries on-disk after they've served their purpose.
var retentionNotificationsAndSilences = 5 * 24 * time.Hour
var silenceMaintenanceInterval = 15 * time.Minute

func init() {
	silence.ValidateMatcher = func(m *pb.Matcher) error {
		switch m.Type {
		case pb.Matcher_EQUAL, pb.Matcher_NOT_EQUAL:
			if !model.LabelValue(m.Pattern).IsValid() {
				return fmt.Errorf("invalid label value %q", m.Pattern)
			}
		case pb.Matcher_REGEXP, pb.Matcher_NOT_REGEXP:
			if _, err := regexp.Compile(m.Pattern); err != nil {
				return fmt.Errorf("invalid regular expression %q: %s", m.Pattern, err)
			}
		default:
			return fmt.Errorf("unknown matcher type %q", m.Type)
		}
		return nil
	}
}

type ClusterPeer interface {
	AddState(string, cluster.State, prometheus.Registerer) cluster.ClusterChannel
	Position() int
	WaitReady(context.Context) error
}

type AlertingStore interface {
	store.AlertingStore
	channels.ImageStore
}

type Alertmanager struct {
	logger log.Logger

	Settings            *setting.Cfg
	Store               AlertingStore
	fileStore           *FileStore
	Metrics             *metrics.Alertmanager
	NotificationService notifications.Service

	notificationLog *nflog.Log
	marker          types.Marker
	alerts          *mem.Alerts
	route           *dispatch.Route
	peer            ClusterPeer
	peerTimeout     time.Duration

	dispatcher *dispatch.Dispatcher
	inhibitor  *inhibit.Inhibitor
	// wg is for dispatcher, inhibitor, silences and notifications
	// Across configuration changes dispatcher and inhibitor are completely replaced, however, silences, notification log and alerts remain the same.
	// stopc is used to let silences and notifications know we are done.
	wg    sync.WaitGroup
	stopc chan struct{}

	silencer *silence.Silencer
	silences *silence.Silences

	// muteTimes is a map where the key is the name of the mute_time_interval
	// and the value represents all configured time_interval(s)
	muteTimes map[string][]timeinterval.TimeInterval

	stageMetrics      *notify.Metrics
	dispatcherMetrics *dispatch.DispatcherMetrics

	reloadConfigMtx sync.RWMutex
	config          *apimodels.PostableUserConfig
	configHash      [16]byte
	orgID           int64

	decryptFn channels.GetDecryptedValueFn
}

func newAlertmanager(ctx context.Context, orgID int64, cfg *setting.Cfg, store AlertingStore, kvStore kvstore.KVStore,
	peer ClusterPeer, decryptFn channels.GetDecryptedValueFn, ns notifications.Service, m *metrics.Alertmanager) (*Alertmanager, error) {
	am := &Alertmanager{
		Settings:            cfg,
		stopc:               make(chan struct{}),
		logger:              log.New("alertmanager", "org", orgID),
		marker:              types.NewMarker(m.Registerer),
		stageMetrics:        notify.NewMetrics(m.Registerer),
		dispatcherMetrics:   dispatch.NewDispatcherMetrics(false, m.Registerer),
		Store:               store,
		peer:                peer,
		peerTimeout:         cfg.UnifiedAlerting.HAPeerTimeout,
		Metrics:             m,
		NotificationService: ns,
		orgID:               orgID,
		decryptFn:           decryptFn,
	}

	am.fileStore = NewFileStore(am.orgID, kvStore, am.WorkingDirPath())

	nflogFilepath, err := am.fileStore.FilepathFor(ctx, notificationLogFilename)
	if err != nil {
		return nil, err
	}
	silencesFilePath, err := am.fileStore.FilepathFor(ctx, silencesFilename)
	if err != nil {
		return nil, err
	}

	// Initialize the notification log
	am.wg.Add(1)
	am.notificationLog, err = nflog.New(
		nflog.WithRetention(retentionNotificationsAndSilences),
		nflog.WithSnapshot(nflogFilepath),
		nflog.WithMaintenance(maintenanceNotificationAndSilences, am.stopc, am.wg.Done, func() (int64, error) {
			return am.fileStore.Persist(ctx, notificationLogFilename, am.notificationLog)
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the notification log component of alerting: %w", err)
	}
	c := am.peer.AddState(fmt.Sprintf("notificationlog:%d", am.orgID), am.notificationLog, m.Registerer)
	am.notificationLog.SetBroadcast(c.Broadcast)

	// Initialize silences
	am.silences, err = silence.New(silence.Options{
		Metrics:      m.Registerer,
		SnapshotFile: silencesFilePath,
		Retention:    retentionNotificationsAndSilences,
	})
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the silencing component of alerting: %w", err)
	}

	c = am.peer.AddState(fmt.Sprintf("silences:%d", am.orgID), am.silences, m.Registerer)
	am.silences.SetBroadcast(c.Broadcast)

	am.wg.Add(1)
	go func() {
		am.silences.Maintenance(silenceMaintenanceInterval, silencesFilePath, am.stopc, func() (int64, error) {
			// Delete silences older than the retention period.
			if _, err := am.silences.GC(); err != nil {
				am.logger.Error("silence garbage collection", "err", err)
				// Don't return here - we need to snapshot our state first.
			}

			// Snapshot our silences to the Grafana KV store
			return am.fileStore.Persist(ctx, silencesFilename, am.silences)
		})
		am.wg.Done()
	}()

	// Initialize in-memory alerts
	am.alerts, err = mem.NewAlerts(context.Background(), am.marker, memoryAlertsGCInterval, nil, am.logger)
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the alert provider component of alerting: %w", err)
	}

	return am, nil
}

func (am *Alertmanager) Ready() bool {
	// We consider AM as ready only when the config has been
	// applied at least once successfully. Until then, some objects
	// can still be nil.
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()

	return am.ready()
}

func (am *Alertmanager) ready() bool {
	return am.config != nil
}

func (am *Alertmanager) StopAndWait() {
	if am.dispatcher != nil {
		am.dispatcher.Stop()
	}

	if am.inhibitor != nil {
		am.inhibitor.Stop()
	}

	am.alerts.Close()

	close(am.stopc)

	am.wg.Wait()
}

// SaveAndApplyDefaultConfig saves the default configuration the database and applies the configuration to the Alertmanager.
// It rollbacks the save if we fail to apply the configuration.
func (am *Alertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	cmd := &ngmodels.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: am.Settings.UnifiedAlerting.DefaultConfiguration,
		Default:                   true,
		ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
		OrgID:                     am.orgID,
	}

	cfg, err := Load([]byte(am.Settings.UnifiedAlerting.DefaultConfiguration))
	if err != nil {
		return err
	}

	err = am.Store.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func() error {
		if err := am.applyConfig(cfg, []byte(am.Settings.UnifiedAlerting.DefaultConfiguration)); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

// SaveAndApplyConfig saves the configuration the database and applies the configuration to the Alertmanager.
// It rollbacks the save if we fail to apply the configuration.
func (am *Alertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	rawConfig, err := json.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to serialize to the Alertmanager configuration: %w", err)
	}

	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

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
		return err
	}

	return nil
}

// ApplyConfig applies the configuration to the Alertmanager.
func (am *Alertmanager) ApplyConfig(dbCfg *ngmodels.AlertConfiguration) error {
	var err error
	cfg, err := Load([]byte(dbCfg.AlertmanagerConfiguration))
	if err != nil {
		return fmt.Errorf("failed to parse Alertmanager config: %w", err)
	}

	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	if err = am.applyConfig(cfg, nil); err != nil {
		return fmt.Errorf("unable to apply configuration: %w", err)
	}
	return nil
}

func (am *Alertmanager) getTemplate() (*template.Template, error) {
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()
	if !am.ready() {
		return nil, errors.New("alertmanager is not initialized")
	}
	paths := make([]string, 0, len(am.config.TemplateFiles))
	for name := range am.config.TemplateFiles {
		paths = append(paths, filepath.Join(am.WorkingDirPath(), name))
	}
	return am.templateFromPaths(paths...)
}

func (am *Alertmanager) templateFromPaths(paths ...string) (*template.Template, error) {
	tmpl, err := template.FromGlobs(paths...)
	if err != nil {
		return nil, err
	}
	externalURL, err := url.Parse(am.Settings.AppURL)
	if err != nil {
		return nil, err
	}
	tmpl.ExternalURL = externalURL
	return tmpl, nil
}

func (am *Alertmanager) buildMuteTimesMap(muteTimeIntervals []config.MuteTimeInterval) map[string][]timeinterval.TimeInterval {
	muteTimes := make(map[string][]timeinterval.TimeInterval, len(muteTimeIntervals))
	for _, ti := range muteTimeIntervals {
		muteTimes[ti.Name] = ti.TimeIntervals
	}
	return muteTimes
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

	if am.configHash != md5.Sum(rawConfig) {
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
	tmpl, err := am.templateFromPaths(paths...)
	if err != nil {
		return err
	}

	// Finally, build the integrations map using the receiver configuration and templates.
	integrationsMap, err := am.buildIntegrationsMap(cfg.AlertmanagerConfig.Receivers, tmpl)
	if err != nil {
		return fmt.Errorf("failed to build integration map: %w", err)
	}

	// Now, let's put together our notification pipeline
	routingStage := make(notify.RoutingStage, len(integrationsMap))

	if am.inhibitor != nil {
		am.inhibitor.Stop()
	}
	if am.dispatcher != nil {
		am.dispatcher.Stop()
	}

	am.inhibitor = inhibit.NewInhibitor(am.alerts, cfg.AlertmanagerConfig.InhibitRules, am.marker, am.logger)
	am.muteTimes = am.buildMuteTimesMap(cfg.AlertmanagerConfig.MuteTimeIntervals)
	am.silencer = silence.NewSilencer(am.silences, am.marker, am.logger)

	meshStage := notify.NewGossipSettleStage(am.peer)
	inhibitionStage := notify.NewMuteStage(am.inhibitor)
	timeMuteStage := notify.NewTimeMuteStage(am.muteTimes)
	silencingStage := notify.NewMuteStage(am.silencer)
	for name := range integrationsMap {
		stage := am.createReceiverStage(name, integrationsMap[name], am.waitFunc, am.notificationLog)
		routingStage[name] = notify.MultiStage{meshStage, silencingStage, timeMuteStage, inhibitionStage, stage}
	}

	am.route = dispatch.NewRoute(cfg.AlertmanagerConfig.Route.AsAMRoute(), nil)
	am.dispatcher = dispatch.NewDispatcher(am.alerts, am.route, routingStage, am.marker, am.timeoutFunc, &nilLimits{}, am.logger, am.dispatcherMetrics)

	am.wg.Add(1)
	go func() {
		defer am.wg.Done()
		am.dispatcher.Run()
	}()

	am.wg.Add(1)
	go func() {
		defer am.wg.Done()
		am.inhibitor.Run()
	}()

	am.config = cfg
	am.configHash = md5.Sum(rawConfig)

	return nil
}

func (am *Alertmanager) WorkingDirPath() string {
	return filepath.Join(am.Settings.DataPath, workingDir, strconv.Itoa(int(am.orgID)))
}

// buildIntegrationsMap builds a map of name to the list of Grafana integration notifiers off of a list of receiver config.
func (am *Alertmanager) buildIntegrationsMap(receivers []*apimodels.PostableApiReceiver, templates *template.Template) (map[string][]notify.Integration, error) {
	integrationsMap := make(map[string][]notify.Integration, len(receivers))
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
func (am *Alertmanager) buildReceiverIntegrations(receiver *apimodels.PostableApiReceiver, tmpl *template.Template) ([]notify.Integration, error) {
	var integrations []notify.Integration
	for i, r := range receiver.GrafanaManagedReceivers {
		n, err := am.buildReceiverIntegration(r, tmpl)
		if err != nil {
			return nil, err
		}
		integrations = append(integrations, notify.NewIntegration(n, n, r.Type, i))
	}
	return integrations, nil
}

func (am *Alertmanager) buildReceiverIntegration(r *apimodels.PostableGrafanaReceiver, tmpl *template.Template) (channels.NotificationChannel, error) {
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
			Settings:              r.Settings,
			SecureSettings:        secureSettings,
		}
	)
	factoryConfig, err := channels.NewFactoryConfig(cfg, am.NotificationService, am.decryptFn, tmpl, am.Store)
	if err != nil {
		return nil, InvalidReceiverError{
			Receiver: r,
			Err:      err,
		}
	}
	receiverFactory, exists := channels.Factory(r.Type)
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
	now := time.Now()
	alerts := make([]*types.Alert, 0, len(postableAlerts.PostableAlerts))
	var validationErr *AlertValidationError
	for _, a := range postableAlerts.PostableAlerts {
		alert := &types.Alert{
			Alert: model.Alert{
				Labels:       model.LabelSet{},
				Annotations:  model.LabelSet{},
				StartsAt:     time.Time(a.StartsAt),
				EndsAt:       time.Time(a.EndsAt),
				GeneratorURL: a.GeneratorURL.String(),
			},
			UpdatedAt: now,
		}

		for k, v := range a.Labels {
			if len(v) == 0 || k == ngmodels.NamespaceUIDLabel { // Skip empty and namespace UID labels.
				continue
			}
			alert.Alert.Labels[model.LabelName(k)] = model.LabelValue(v)
		}
		for k, v := range a.Annotations {
			if len(v) == 0 { // Skip empty annotation.
				continue
			}
			alert.Alert.Annotations[model.LabelName(k)] = model.LabelValue(v)
		}

		// Ensure StartsAt is set.
		if alert.StartsAt.IsZero() {
			if alert.EndsAt.IsZero() {
				alert.StartsAt = now
			} else {
				alert.StartsAt = alert.EndsAt
			}
		}
		// If no end time is defined, set a timeout after which an alert
		// is marked resolved if it is not updated.
		if alert.EndsAt.IsZero() {
			alert.Timeout = true
			alert.EndsAt = now.Add(defaultResolveTimeout)
		}

		if alert.EndsAt.After(now) {
			am.Metrics.Firing().Inc()
		} else {
			am.Metrics.Resolved().Inc()
		}

		if err := validateAlert(alert); err != nil {
			if validationErr == nil {
				validationErr = &AlertValidationError{}
			}
			validationErr.Alerts = append(validationErr.Alerts, a)
			validationErr.Errors = append(validationErr.Errors, err)
			am.Metrics.Invalid().Inc()
			continue
		}

		alerts = append(alerts, alert)
	}

	if err := am.alerts.Put(alerts...); err != nil {
		// Notification sending alert takes precedence over validation errors.
		return err
	}
	if validationErr != nil {
		// Even if validationErr is nil, the require.NoError fails on it.
		return validationErr
	}
	return nil
}

// validateAlert is a.Validate() while additionally allowing
// space for label and annotation names.
func validateAlert(a *types.Alert) error {
	if a.StartsAt.IsZero() {
		return fmt.Errorf("start time missing")
	}
	if !a.EndsAt.IsZero() && a.EndsAt.Before(a.StartsAt) {
		return fmt.Errorf("start time must be before end time")
	}
	if err := validateLabelSet(a.Labels); err != nil {
		return fmt.Errorf("invalid label set: %s", err)
	}
	if len(a.Labels) == 0 {
		return fmt.Errorf("at least one label pair required")
	}
	if err := validateLabelSet(a.Annotations); err != nil {
		return fmt.Errorf("invalid annotations: %s", err)
	}
	return nil
}

// validateLabelSet is ls.Validate() while additionally allowing
// space for label names.
func validateLabelSet(ls model.LabelSet) error {
	for ln, lv := range ls {
		if !isValidLabelName(ln) {
			return fmt.Errorf("invalid name %q", ln)
		}
		if !lv.IsValid() {
			return fmt.Errorf("invalid value %q", lv)
		}
	}
	return nil
}

// isValidLabelName is ln.IsValid() without restrictions other than it can not be empty.
// The regex for Prometheus data model is ^[a-zA-Z_][a-zA-Z0-9_]*$.
func isValidLabelName(ln model.LabelName) bool {
	if len(ln) == 0 {
		return false
	}

	return utf8.ValidString(string(ln))
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

// createReceiverStage creates a pipeline of stages for a receiver.
func (am *Alertmanager) createReceiverStage(name string, integrations []notify.Integration, wait func() time.Duration, notificationLog notify.NotificationLog) notify.Stage {
	var fs notify.FanoutStage
	for i := range integrations {
		recv := &nflogpb.Receiver{
			GroupName:   name,
			Integration: integrations[i].Name(),
			Idx:         uint32(integrations[i].Index()),
		}
		var s notify.MultiStage
		s = append(s, notify.NewWaitStage(wait))
		s = append(s, notify.NewDedupStage(&integrations[i], notificationLog, recv))
		s = append(s, notify.NewRetryStage(integrations[i], name, am.stageMetrics))
		s = append(s, notify.NewSetNotifiesStage(notificationLog, recv))

		fs = append(fs, s)
	}
	return fs
}

func (am *Alertmanager) waitFunc() time.Duration {
	return time.Duration(am.peer.Position()) * am.peerTimeout
}

func (am *Alertmanager) timeoutFunc(d time.Duration) time.Duration {
	// time.Duration d relates to the receiver's group_interval. Even with a group interval of 1s,
	// we need to make sure (non-position-0) peers in the cluster wait before flushing the notifications.
	if d < notify.MinTimeout {
		d = notify.MinTimeout
	}
	return d + am.waitFunc()
}

type nilLimits struct{}

func (n nilLimits) MaxNumberOfAggregationGroups() int { return 0 }

package remote

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-openapi/strfmt"
	alertingClusterPB "github.com/grafana/alerting/cluster/clusterpb"
	"github.com/grafana/alerting/definition"
	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	amalert "github.com/prometheus/alertmanager/api/v2/client/alert"
	amalertgroup "github.com/prometheus/alertmanager/api/v2/client/alertgroup"
	amgeneral "github.com/prometheus/alertmanager/api/v2/client/general"
	amsilence "github.com/prometheus/alertmanager/api/v2/client/silence"
	"github.com/prometheus/client_golang/prometheus"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	remoteClient "github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
)

type stateStore interface {
	GetSilences(ctx context.Context) (string, error)
	GetNotificationLog(ctx context.Context) (string, error)
}

// AutogenFn is a function that adds auto-generated routes to a configuration.
type AutogenFn func(ctx context.Context, logger log.Logger, orgId int64, config *apimodels.PostableApiAlertingConfig, skipInvalid bool) error

// NoopAutogenFn is used to skip auto-generating routes.
func NoopAutogenFn(_ context.Context, _ log.Logger, _ int64, _ *apimodels.PostableApiAlertingConfig, _ bool) error {
	return nil
}

type Crypto interface {
	Decrypt(ctx context.Context, payload []byte) ([]byte, error)
	DecryptExtraConfigs(ctx context.Context, config *apimodels.PostableUserConfig) error
}

type Alertmanager struct {
	autogenFn         AutogenFn
	crypto            Crypto
	defaultConfig     string
	defaultConfigHash string
	log               log.Logger
	metrics           *metrics.RemoteAlertmanager
	orgID             int64
	ready             bool
	sender            *sender.ExternalAlertmanager
	smtp              remoteClient.SmtpConfig
	state             stateStore
	tenantID          string
	url               string

	lastConfigSync time.Time
	syncInterval   time.Duration

	amClient    *remoteClient.Alertmanager
	mimirClient remoteClient.MimirClient
}

type AlertmanagerConfig struct {
	OrgID             int64
	URL               string
	TenantID          string
	BasicAuthPassword string

	DefaultConfig string

	// ExternalURL is used in notifications sent by the remote Alertmanager.
	ExternalURL string

	// PromoteConfig is a flag that determines whether the configuration should be used in the remote Alertmanager.
	// The same flag is used for promoting state.
	PromoteConfig bool

	// SmtpConfig has all the necessary settings for the remote Alertmanager to create an email sender.
	SmtpConfig remoteClient.SmtpConfig

	// SyncInterval determines how often we should attempt to synchronize configuration.
	SyncInterval time.Duration

	// Timeout for the HTTP client.
	Timeout time.Duration
}

func (cfg *AlertmanagerConfig) Validate() error {
	if cfg.OrgID == 0 {
		return fmt.Errorf("orgID for remote Alertmanager not set")
	}

	if cfg.TenantID == "" {
		return fmt.Errorf("empty remote Alertmanager tenantID")
	}

	if cfg.URL == "" {
		return fmt.Errorf("empty remote Alertmanager URL for tenant '%s'", cfg.TenantID)
	}
	return nil
}

func NewAlertmanager(ctx context.Context, cfg AlertmanagerConfig, store stateStore, crypto Crypto, autogenFn AutogenFn, metrics *metrics.RemoteAlertmanager, tracer tracing.Tracer) (*Alertmanager, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse remote Alertmanager URL: %w", err)
	}
	logger := log.New("ngalert.remote.alertmanager")

	mcCfg := &remoteClient.Config{
		Logger:        logger,
		Password:      cfg.BasicAuthPassword,
		TenantID:      cfg.TenantID,
		URL:           u,
		PromoteConfig: cfg.PromoteConfig,
		ExternalURL:   cfg.ExternalURL,
		Smtp:          cfg.SmtpConfig,
	}
	mc, err := remoteClient.New(mcCfg, metrics, tracer)
	if err != nil {
		return nil, err
	}

	amcCfg := &remoteClient.AlertmanagerConfig{
		URL:      u,
		TenantID: cfg.TenantID,
		Password: cfg.BasicAuthPassword,
		Logger:   logger,
		Timeout:  cfg.Timeout,
	}
	amc, err := remoteClient.NewAlertmanager(amcCfg, metrics, tracer)
	if err != nil {
		return nil, err
	}

	// Configure and start the components that sends alerts.
	c := amc.GetAuthedClient()
	doFunc := func(ctx context.Context, _ *http.Client, req *http.Request) (*http.Response, error) {
		return c.Do(req.WithContext(ctx))
	}
	senderLogger := log.New("ngalert.sender.external-alertmanager")
	s, err := sender.NewExternalAlertmanagerSender(
		senderLogger,
		prometheus.NewRegistry(),
		sender.WithDoFunc(doFunc),
		sender.WithUTF8Labels(),
	)
	if err != nil {
		return nil, err
	}
	s.Run()
	err = s.ApplyConfig(cfg.OrgID, 0, []sender.ExternalAMcfg{{URL: cfg.URL + "/alertmanager", Timeout: cfg.Timeout}})
	if err != nil {
		return nil, err
	}

	am := &Alertmanager{
		amClient:          amc,
		autogenFn:         autogenFn,
		crypto:            crypto,
		defaultConfig:     cfg.DefaultConfig,
		defaultConfigHash: "", // calculated below
		log:               logger,
		metrics:           metrics,
		mimirClient:       mc,
		orgID:             cfg.OrgID,
		state:             store,
		sender:            s,
		syncInterval:      cfg.SyncInterval,
		tenantID:          cfg.TenantID,
		url:               cfg.URL,
		smtp:              cfg.SmtpConfig,
	}

	// Parse the default configuration once and remember its hash so we can compare it later.
	// Known edge case: assigning a default contact point to a rule and setting route overrides
	// (grouping, group timing, time intervals etc) changes the autogenerated configuration.
	// The `default` flag is sent to the remote Alertmanager for informational purposes, so we can tolerate this.
	err = func() error {
		defaultCfg, err := am.buildConfiguration(ctx, []byte(cfg.DefaultConfig))
		if err != nil {
			return fmt.Errorf("unable to build default configuration: %w", err)
		}
		rawDefaultCfg, err := json.Marshal(defaultCfg)
		if err != nil {
			return fmt.Errorf("unable to marshal default configuration: %w", err)
		}
		am.defaultConfigHash = fmt.Sprintf("%x", md5.Sum(rawDefaultCfg))
		return nil
	}()
	if err != nil {
		logger.Error("Unable to calculate hash of the default configuration. Remote Alertmanager will always get isDefault=false", "error", err)
	}
	// Initialize LastReadinessCheck so it's present even if the check fails.
	metrics.LastReadinessCheck.Set(0)

	return am, nil
}

// ApplyConfig is called by the multi-org Alertmanager on startup and on every sync loop iteration (1m default).
// We do two things on startup:
// 1. Execute a readiness check to make sure the remote Alertmanager we're about to communicate with is up and ready.
// 2. Upload the configuration and state we currently hold.
// On each subsequent call to ApplyConfig we compare and upload only the configuration.
func (am *Alertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	if am.ready {
		am.log.Debug("Alertmanager previously marked as ready, skipping readiness check and state sync")
	} else {
		am.log.Debug("Start readiness check for remote Alertmanager", "url", am.url)
		if err := am.checkReadiness(ctx); err != nil {
			return fmt.Errorf("unable to pass the readiness check: %w", err)
		}
		am.log.Debug("Completed readiness check for remote Alertmanager, starting state upload", "url", am.url)

		if err := am.SendState(ctx); err != nil {
			return fmt.Errorf("unable to upload the state to the remote Alertmanager: %w", err)
		}
		am.log.Debug("Completed state upload to remote Alertmanager", "url", am.url)
	}

	if time.Since(am.lastConfigSync) < am.syncInterval {
		am.log.Debug("Not syncing configuration to remote Alertmanager, last sync was too recent")
		return nil
	}

	am.log.Debug("Start configuration upload to remote Alertmanager", "url", am.url)
	if err := am.CompareAndSendConfiguration(ctx, config); err != nil {
		return fmt.Errorf("unable to upload the configuration to the remote Alertmanager: %w", err)
	}
	am.log.Debug("Completed configuration upload to remote Alertmanager", "url", am.url)
	return nil
}

func (am *Alertmanager) checkReadiness(ctx context.Context) error {
	err := am.amClient.IsReadyWithBackoff(ctx)
	if err != nil {
		return err
	}

	am.log.Debug("Alertmanager readiness check successful")
	am.metrics.LastReadinessCheck.SetToCurrentTime()
	am.ready = true
	return nil
}

// CompareAndSendConfiguration checks whether a given configuration is being used by the remote Alertmanager.
// If not, it sends the configuration to the remote Alertmanager.
func (am *Alertmanager) CompareAndSendConfiguration(ctx context.Context, config *models.AlertConfiguration) error {
	payload, err := am.buildConfiguration(ctx, []byte(config.AlertmanagerConfiguration))
	if err != nil {
		return fmt.Errorf("unable to build configuration: %w", err)
	}
	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("unable to marshal decrypted configuration: %w", err)
	}
	configHash := fmt.Sprintf("%x", md5.Sum(rawPayload))

	// Send the configuration only if we need to.
	if !am.shouldSendConfig(ctx, configHash) {
		return nil
	}

	return am.sendConfiguration(ctx, payload, configHash, config.CreatedAt, am.isDefaultConfiguration(configHash))
}

func (am *Alertmanager) isDefaultConfiguration(configHash string) bool {
	return configHash == am.defaultConfigHash
}

func decrypter(ctx context.Context, crypto Crypto) models.DecryptFn {
	return func(value string) (string, error) {
		decoded, err := base64.StdEncoding.DecodeString(value)
		if err != nil {
			return "", err
		}
		decrypted, err := crypto.Decrypt(ctx, decoded)
		if err != nil {
			return "", err
		}
		return string(decrypted), nil
	}
}

// buildConfiguration takes a raw Alertmanager configuration and returns a config that the remote Alertmanager can use.
// It parses the initial configuration, adds auto-generated routes, decrypts receivers, and merges the extra configs.
func (am *Alertmanager) buildConfiguration(ctx context.Context, raw []byte) (remoteClient.GrafanaAlertmanagerConfig, error) {
	c, err := notifier.Load(raw)
	if err != nil {
		return remoteClient.GrafanaAlertmanagerConfig{}, err
	}

	// Add auto-generated routes and decrypt before comparing.
	if err := am.autogenFn(ctx, am.log, am.orgID, &c.AlertmanagerConfig, true); err != nil {
		return remoteClient.GrafanaAlertmanagerConfig{}, err
	}

	// Decrypt the receivers in the configuration.
	decryptedReceivers, err := legacy_storage.DecryptedReceivers(c.AlertmanagerConfig.Receivers, decrypter(ctx, am.crypto))
	if err != nil {
		return remoteClient.GrafanaAlertmanagerConfig{}, fmt.Errorf("unable to decrypt receivers: %w", err)
	}
	c.AlertmanagerConfig.Receivers = decryptedReceivers

	if err := am.crypto.DecryptExtraConfigs(ctx, c); err != nil {
		return remoteClient.GrafanaAlertmanagerConfig{}, fmt.Errorf("unable to decrypt extra configs: %w", err)
	}

	mergeResult, err := c.GetMergedAlertmanagerConfig()
	if err != nil {
		return remoteClient.GrafanaAlertmanagerConfig{}, fmt.Errorf("unable to get merged Alertmanager configuration: %w", err)
	}

	var templates []definition.PostableApiTemplate
	if len(c.ExtraConfigs) > 0 && len(c.ExtraConfigs[0].TemplateFiles) > 0 {
		templates = definition.TemplatesMapToPostableAPITemplates(c.ExtraConfigs[0].TemplateFiles, definition.MimirTemplateKind)
	}

	return remoteClient.GrafanaAlertmanagerConfig{
		TemplateFiles:      c.TemplateFiles,
		AlertmanagerConfig: mergeResult.Config,
		Templates:          templates,
	}, nil
}

func (am *Alertmanager) sendConfiguration(ctx context.Context, cfg remoteClient.GrafanaAlertmanagerConfig, hash string, createdAt int64, isDefault bool) error {
	am.metrics.ConfigSyncsTotal.Inc()
	if err := am.mimirClient.CreateGrafanaAlertmanagerConfig(
		ctx,
		cfg,
		hash,
		createdAt,
		isDefault,
	); err != nil {
		am.metrics.ConfigSyncErrorsTotal.Inc()
		return err
	}
	am.metrics.LastConfigSync.SetToCurrentTime()
	am.lastConfigSync = time.Now()
	return nil
}

// GetRemoteState gets the remote Alertmanager's internal state.
func (am *Alertmanager) GetRemoteState(ctx context.Context) (notifier.ExternalState, error) {
	var rs notifier.ExternalState

	s, err := am.mimirClient.GetFullState(ctx)
	if err != nil {
		return rs, fmt.Errorf("failed to pull remote state: %w", err)
	}

	// Decode and unmarshal the base64-encoded state we got from Mimir.
	decoded, err := base64.StdEncoding.DecodeString(s.State)
	if err != nil {
		return rs, fmt.Errorf("failed to base64-decode remote state: %w", err)
	}
	protoState := &alertingClusterPB.FullState{}
	if err := protoState.Unmarshal(decoded); err != nil {
		return rs, fmt.Errorf("failed to unmarshal remote state: %w", err)
	}

	// Mimir state has two parts:
	// - "sil:<tenantID>": silences
	// - "nfl:<tenantID>": notification log entries
	// The tenant ID can be different in the remote AM, so we consider only the part before the ':'.
	for _, p := range protoState.Parts {
		k := strings.Split(p.Key, ":")
		switch k[0] {
		case "sil":
			rs.Silences = p.Data
		case "nfl":
			rs.Nflog = p.Data
		default:
			return rs, fmt.Errorf("unknown part key %q", p.Key)
		}
	}

	return rs, nil
}

// SendState gets the Alertmanager's internal state and sends it to the remote Alertmanager.
func (am *Alertmanager) SendState(ctx context.Context) error {
	am.metrics.StateSyncsTotal.Inc()

	state, err := am.getFullState(ctx)
	if err != nil {
		am.metrics.StateSyncErrorsTotal.Inc()
		return err
	}

	if err := am.mimirClient.CreateGrafanaAlertmanagerState(ctx, state); err != nil {
		am.metrics.StateSyncErrorsTotal.Inc()
		return err
	}

	am.metrics.LastStateSync.SetToCurrentTime()
	return nil
}

// SaveAndApplyConfig decrypts and sends a configuration to the remote Alertmanager.
func (am *Alertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	// Copy the configuration by marshalling to avoid any mutations to the provided configuration.
	rawCopy, err := json.Marshal(cfg)
	if err != nil {
		return err
	}

	payload, err := am.buildConfiguration(ctx, rawCopy)
	if err != nil {
		return fmt.Errorf("unable to build configuration: %w", err)
	}

	rawCfg, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	hash := fmt.Sprintf("%x", md5.Sum(rawCfg))

	return am.sendConfiguration(ctx, payload, hash, time.Now().Unix(), false)
}

// SaveAndApplyDefaultConfig sends the default Grafana Alertmanager configuration to the remote Alertmanager.
func (am *Alertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	am.log.Debug("Sending default configuration to a remote Alertmanager", "url", am.url)
	payload, err := am.buildConfiguration(ctx, []byte(am.defaultConfig))
	if err != nil {
		return fmt.Errorf("unable to build default configuration: %w", err)
	}

	rawCfg, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	hash := fmt.Sprintf("%x", md5.Sum(rawCfg))

	return am.sendConfiguration(
		ctx,
		payload,
		hash,
		time.Now().Unix(),
		true,
	)
}

func (am *Alertmanager) CreateSilence(ctx context.Context, silence *apimodels.PostableSilence) (string, error) {
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while creating silence", "err", r)
		}
	}()

	params := amsilence.NewPostSilencesParamsWithContext(ctx).WithSilence(silence)
	res, err := am.amClient.Silence.PostSilences(params)
	if err != nil {
		return "", err
	}

	return res.Payload.SilenceID, nil
}

func (am *Alertmanager) DeleteSilence(ctx context.Context, silenceID string) error {
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while deleting silence", "err", r)
		}
	}()

	params := amsilence.NewDeleteSilenceParamsWithContext(ctx).WithSilenceID(strfmt.UUID(silenceID))
	_, err := am.amClient.Silence.DeleteSilence(params)
	if err != nil {
		return err
	}
	return nil
}

func (am *Alertmanager) GetSilence(ctx context.Context, silenceID string) (apimodels.GettableSilence, error) {
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while getting silence", "err", r)
		}
	}()

	params := amsilence.NewGetSilenceParamsWithContext(ctx).WithSilenceID(strfmt.UUID(silenceID))
	res, err := am.amClient.Silence.GetSilence(params)
	if err != nil {
		return apimodels.GettableSilence{}, err
	}

	return *res.Payload, nil
}

func (am *Alertmanager) ListSilences(ctx context.Context, filter []string) (apimodels.GettableSilences, error) {
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while listing silences", "err", r)
		}
	}()

	params := amsilence.NewGetSilencesParamsWithContext(ctx).WithFilter(filter)
	res, err := am.amClient.Silence.GetSilences(params)
	if err != nil {
		return apimodels.GettableSilences{}, err
	}

	return res.Payload, nil
}

func (am *Alertmanager) GetAlerts(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while getting alerts", "err", r)
		}
	}()

	params := amalert.NewGetAlertsParamsWithContext(ctx).
		WithActive(&active).
		WithSilenced(&silenced).
		WithInhibited(&inhibited).
		WithFilter(filter).
		WithReceiver(&receiver)

	res, err := am.amClient.Alert.GetAlerts(params)
	if err != nil {
		return apimodels.GettableAlerts{}, err
	}

	return res.Payload, nil
}

func (am *Alertmanager) GetAlertGroups(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while getting alert groups", "err", r)
		}
	}()

	params := amalertgroup.NewGetAlertGroupsParamsWithContext(ctx).
		WithActive(&active).
		WithSilenced(&silenced).
		WithInhibited(&inhibited).
		WithFilter(filter).
		WithReceiver(&receiver)

	res, err := am.amClient.Alertgroup.GetAlertGroups(params)
	if err != nil {
		return apimodels.AlertGroups{}, err
	}

	return res.Payload, nil
}

func (am *Alertmanager) PutAlerts(ctx context.Context, alerts apimodels.PostableAlerts) error {
	for _, a := range alerts.PostableAlerts {
		for k, v := range a.Labels {
			// The Grafana Alertmanager skips empty and namespace UID labels.
			// To get the same alert fingerprint we need to remove these labels too.
			// https://github.com/grafana/alerting/blob/2dda1c67ec02625ac9fc8607157b3d5825d47919/notify/grafana_alertmanager.go#L722-L724
			if len(v) == 0 || k == alertingModels.NamespaceUIDLabel {
				delete(a.Labels, k)
			}
		}
	}
	am.log.Debug("Sending alerts to a remote alertmanager", "url", am.url, "alerts", len(alerts.PostableAlerts))
	am.sender.SendAlerts(alerts)
	return nil
}

// GetStatus retrieves the remote Alertmanager configuration.
func (am *Alertmanager) GetStatus(ctx context.Context) (apimodels.GettableStatus, error) {
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while getting status", "err", r)
		}
	}()

	params := amgeneral.NewGetStatusParamsWithContext(ctx)
	res, err := am.amClient.General.GetStatus(params)
	if err != nil {
		return apimodels.GettableStatus{}, err
	}

	var cfg apimodels.PostableApiAlertingConfig
	if err := yaml.Unmarshal([]byte(*res.Payload.Config.Original), &cfg); err != nil {
		return apimodels.GettableStatus{}, err
	}

	return *apimodels.NewGettableStatus(&cfg), nil
}

func (am *Alertmanager) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	return am.mimirClient.GetReceivers(ctx)
}

func (am *Alertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*alertingNotify.TestReceiversResult, int, error) {
	decryptedReceivers, err := legacy_storage.DecryptedReceivers(c.Receivers, decrypter(ctx, am.crypto))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to decrypt receivers: %w", err)
	}

	apiReceivers := make([]*alertingNotify.APIReceiver, 0, len(c.Receivers))
	for _, r := range decryptedReceivers {
		apiReceivers = append(apiReceivers, notifier.PostableApiReceiverToApiReceiver(r))
	}
	var alert *alertingNotify.TestReceiversConfigAlertParams
	if c.Alert != nil {
		alert = &alertingNotify.TestReceiversConfigAlertParams{Annotations: c.Alert.Annotations, Labels: c.Alert.Labels}
	}

	return am.mimirClient.TestReceivers(ctx, alertingNotify.TestReceiversConfigBodyParams{
		Alert:     alert,
		Receivers: apiReceivers,
	})
}

func (am *Alertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*notifier.TestTemplatesResults, error) {
	for _, alert := range c.Alerts {
		notifier.AddDefaultLabelsAndAnnotations(alert)
	}

	return am.mimirClient.TestTemplate(ctx, alertingNotify.TestTemplatesConfigBodyParams{
		Alerts:   c.Alerts,
		Template: c.Template,
		Name:     c.Name,
	})
}

// StopAndWait is called when the grafana server is instructed to shut down or an org is deleted.
// In the context of a "remote Alertmanager" it is a good heuristic for Grafana is about to shut down or we no longer need you.
func (am *Alertmanager) StopAndWait() {
	am.sender.Stop()
}

func (am *Alertmanager) Ready() bool {
	return am.ready
}

// SilenceState returns the Alertmanager's silence state as a SilenceState. Currently, does not retrieve the state
// remotely and instead uses the value from the state store.
func (am *Alertmanager) SilenceState(ctx context.Context) (alertingNotify.SilenceState, error) {
	silences, err := am.state.GetSilences(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting silences: %w", err)
	}

	return alertingNotify.DecodeState(strings.NewReader(silences))
}

// getFullState returns a base64-encoded protobuf message representing the Alertmanager's internal state.
func (am *Alertmanager) getFullState(ctx context.Context) (string, error) {
	var parts []alertingClusterPB.Part

	state, err := am.SilenceState(ctx)
	if err != nil {
		return "", fmt.Errorf("error getting silences: %w", err)
	}
	b, err := state.MarshalBinary()
	if err != nil {
		return "", fmt.Errorf("error marshalling silences: %w", err)
	}
	parts = append(parts, alertingClusterPB.Part{Key: notifier.SilencesFilename, Data: b})

	notificationLog, err := am.state.GetNotificationLog(ctx)
	if err != nil {
		return "", fmt.Errorf("error getting notification log: %w", err)
	}
	parts = append(parts, alertingClusterPB.Part{Key: notifier.NotificationLogFilename, Data: []byte(notificationLog)})

	fs := alertingClusterPB.FullState{
		Parts: parts,
	}
	b, err = fs.Marshal()
	if err != nil {
		return "", fmt.Errorf("error marshaling full state: %w", err)
	}

	return base64.StdEncoding.EncodeToString(b), nil
}

// shouldSendConfig compares the remote Alertmanager configuration with our local one.
// It returns true if the configurations are different.
func (am *Alertmanager) shouldSendConfig(ctx context.Context, hash string) bool {
	rc, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
	if err != nil {
		// Log the error and return true so we try to upload our config anyway.
		am.log.Warn("Unable to get the remote Alertmanager configuration for comparison, sending the configuration without comparing", "err", err)
		return true
	}

	if rc.Promoted != am.mimirClient.ShouldPromoteConfig() {
		return true
	}

	// Compare SMTP configs.
	if rc.SmtpConfig.EhloIdentity != am.smtp.EhloIdentity ||
		rc.SmtpConfig.Password != am.smtp.Password ||
		rc.SmtpConfig.FromAddress != am.smtp.FromAddress ||
		rc.SmtpConfig.FromName != am.smtp.FromName ||
		rc.SmtpConfig.Host != am.smtp.Host ||
		rc.SmtpConfig.SkipVerify != am.smtp.SkipVerify ||
		rc.SmtpConfig.StartTLSPolicy != am.smtp.StartTLSPolicy ||
		len(rc.SmtpConfig.StaticHeaders) != len(am.smtp.StaticHeaders) ||
		rc.SmtpConfig.User != am.smtp.User {
		am.log.Debug("SMTP config is different, sending the configuration to the remote Alertmanager")
		return true
	}

	for k, v := range rc.SmtpConfig.StaticHeaders {
		if value, ok := am.smtp.StaticHeaders[k]; !ok || v != value {
			am.log.Debug("SMTP static headers are different, sending the configuration to the remote Alertmanager")
			return true
		}
	}

	return rc.Hash != hash
}

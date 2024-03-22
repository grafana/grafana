package remote

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	remoteClient "github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	amalert "github.com/prometheus/alertmanager/api/v2/client/alert"
	amalertgroup "github.com/prometheus/alertmanager/api/v2/client/alertgroup"
	amreceiver "github.com/prometheus/alertmanager/api/v2/client/receiver"
	amsilence "github.com/prometheus/alertmanager/api/v2/client/silence"
)

type stateStore interface {
	GetFullState(ctx context.Context, keys ...string) (string, error)
}

// DecryptFn is a function that takes in an encrypted value and returns it decrypted.
type DecryptFn func(ctx context.Context, payload []byte) ([]byte, error)

type Alertmanager struct {
	decrypt       DecryptFn
	defaultConfig string
	log           log.Logger
	metrics       *metrics.RemoteAlertmanager
	orgID         int64
	ready         bool
	sender        *sender.ExternalAlertmanager
	state         stateStore
	tenantID      string
	url           string

	amClient    *remoteClient.Alertmanager
	mimirClient remoteClient.MimirClient
}

type AlertmanagerConfig struct {
	OrgID             int64
	URL               string
	TenantID          string
	BasicAuthPassword string
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

func NewAlertmanager(cfg AlertmanagerConfig, store stateStore, decryptFn DecryptFn, defaultConfig string, metrics *metrics.RemoteAlertmanager) (*Alertmanager, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse remote Alertmanager URL: %w", err)
	}
	logger := log.New("ngalert.remote.alertmanager")

	mcCfg := &remoteClient.Config{
		URL:      u,
		TenantID: cfg.TenantID,
		Password: cfg.BasicAuthPassword,
		Logger:   logger,
	}
	mc, err := remoteClient.New(mcCfg, metrics)
	if err != nil {
		return nil, err
	}

	amcCfg := &remoteClient.AlertmanagerConfig{
		URL:      u,
		TenantID: cfg.TenantID,
		Password: cfg.BasicAuthPassword,
		Logger:   logger,
	}
	amc, err := remoteClient.NewAlertmanager(amcCfg, metrics)
	if err != nil {
		return nil, err
	}

	// Configure and start the components that sends alerts.
	c := amc.GetAuthedClient()
	doFunc := func(ctx context.Context, _ *http.Client, req *http.Request) (*http.Response, error) {
		return c.Do(req.WithContext(ctx))
	}
	s := sender.NewExternalAlertmanagerSender(sender.WithDoFunc(doFunc))
	s.Run()
	err = s.ApplyConfig(cfg.OrgID, 0, []sender.ExternalAMcfg{{URL: cfg.URL + "/alertmanager"}})
	if err != nil {
		return nil, err
	}

	// Initialize LastReadinessCheck so it's present even if the check fails.
	metrics.LastReadinessCheck.Set(0)

	return &Alertmanager{
		amClient:    amc,
		decrypt:     decryptFn,
		log:         logger,
		metrics:     metrics,
		mimirClient: mc,
		orgID:       cfg.OrgID,
		state:       store,
		sender:      s,
		tenantID:    cfg.TenantID,
		url:         cfg.URL,
	}, nil
}

// ApplyConfig is called everytime we've determined we need to apply an existing configuration to the Alertmanager,
// including the first time the Alertmanager is started. In the context of a "remote Alertmanager" it's as good of a heuristic,
// for "a function that gets called when the Alertmanager starts". As a result we do two things:
// 1. Execute a readiness check to make sure the remote Alertmanager we're about to communicate with is up and ready.
// 2. Upload the configuration and state we currently hold.
func (am *Alertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	if am.ready {
		am.log.Debug("Alertmanager previously marked as ready, skipping readiness check and config + state update")
		return nil
	}

	// First, execute a readiness check to make sure the remote Alertmanager is ready.
	am.log.Debug("Start readiness check for remote Alertmanager", "url", am.url)
	if err := am.checkReadiness(ctx); err != nil {
		am.log.Error("Unable to pass the readiness check", "err", err)
		return err
	}
	am.log.Debug("Completed readiness check for remote Alertmanager", "url", am.url)

	// Send configuration and base64-encoded state if necessary.
	am.log.Debug("Start configuration upload to remote Alertmanager", "url", am.url)
	if err := am.CompareAndSendConfiguration(ctx, config); err != nil {
		am.log.Error("Unable to upload the configuration to the remote Alertmanager", "err", err)
	}
	am.log.Debug("Completed configuration upload to remote Alertmanager", "url", am.url)

	am.log.Debug("Start state upload to remote Alertmanager", "url", am.url)
	if err := am.CompareAndSendState(ctx); err != nil {
		am.log.Error("Unable to upload the state to the remote Alertmanager", "err", err)
	}
	am.log.Debug("Completed state upload to remote Alertmanager", "url", am.url)

	return nil
}

func (am *Alertmanager) checkReadiness(ctx context.Context) error {
	ready, err := am.amClient.IsReadyWithBackoff(ctx)
	if err != nil {
		return err
	}

	if ready {
		am.log.Debug("Alertmanager readiness check successful")
		am.metrics.LastReadinessCheck.SetToCurrentTime()
		am.ready = true
		return nil
	}

	return notifier.ErrAlertmanagerNotReady
}

// CompareAndSendConfiguration checks whether a given configuration is being used by the remote Alertmanager.
// If not, it sends the configuration to the remote Alertmanager.
func (am *Alertmanager) CompareAndSendConfiguration(ctx context.Context, config *models.AlertConfiguration) error {
	// Decrypt the configuration before comparing.
	rawDecrypted, err := am.decryptConfiguration(ctx, config.AlertmanagerConfiguration)
	if err != nil {
		return err
	}

	// Send the configuration only if we need to.
	if !am.shouldSendConfig(ctx, rawDecrypted) {
		return nil
	}

	return am.sendConfiguration(ctx, string(rawDecrypted), config.ConfigurationHash, config.CreatedAt, config.Default)
}

// decryptConfiguration decrypts secure fields in a configuration, returning it as a slice of bytes.
func (am *Alertmanager) decryptConfiguration(ctx context.Context, cfg string) ([]byte, error) {
	c, err := notifier.Load([]byte(cfg))
	if err != nil {
		return nil, err
	}

	fn := func(payload []byte) ([]byte, error) {
		return am.decrypt(ctx, payload)
	}
	decrypted, err := c.Decrypt(fn)
	if err != nil {
		return nil, err
	}
	return json.Marshal(decrypted)
}

func (am *Alertmanager) sendConfiguration(ctx context.Context, cfg, hash string, createdAt int64, isDefault bool) error {
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
	return nil
}

// CompareAndSendState gets the Alertmanager's internal state and compares it with the remote Alertmanager's one.
// If the states are different, it updates the remote Alertmanager's state with that of the internal Alertmanager.
func (am *Alertmanager) CompareAndSendState(ctx context.Context) error {
	state, err := am.state.GetFullState(ctx, notifier.SilencesFilename, notifier.NotificationLogFilename)
	if err != nil {
		return err
	}

	if am.shouldSendState(ctx, state) {
		am.metrics.StateSyncsTotal.Inc()
		if err := am.mimirClient.CreateGrafanaAlertmanagerState(ctx, state); err != nil {
			am.metrics.StateSyncErrorsTotal.Inc()
			return err
		}
		am.metrics.LastStateSync.SetToCurrentTime()
	}
	return nil
}

func (am *Alertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	return nil
}

// SaveAndApplyDefaultConfig sends the default Grafana Alertmanager configuration to the remote Alertmanager.
func (am *Alertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	rawDecrypted, err := am.decryptConfiguration(ctx, am.defaultConfig)
	if err != nil {
		return fmt.Errorf("unable to decrypt default configuration: %w", err)
	}

	return am.sendConfiguration(
		ctx,
		string(rawDecrypted),
		fmt.Sprintf("%x", md5.Sum(rawDecrypted)),
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
	am.log.Debug("Sending alerts to a remote alertmanager", "url", am.url, "alerts", len(alerts.PostableAlerts))
	am.sender.SendAlerts(alerts)
	return nil
}

func (am *Alertmanager) GetStatus() apimodels.GettableStatus {
	return apimodels.GettableStatus{}
}

func (am *Alertmanager) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	params := amreceiver.NewGetReceiversParamsWithContext(ctx)
	res, err := am.amClient.Receiver.GetReceivers(params)
	if err != nil {
		return []apimodels.Receiver{}, err
	}

	var rcvs []apimodels.Receiver
	for _, rcv := range res.Payload {
		rcvs = append(rcvs, *rcv)
	}
	return rcvs, nil
}

func (am *Alertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*notifier.TestReceiversResult, error) {
	return &notifier.TestReceiversResult{}, nil
}

func (am *Alertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*notifier.TestTemplatesResults, error) {
	return &notifier.TestTemplatesResults{}, nil
}

// StopAndWait is called when the grafana server is instructed to shut down or an org is deleted.
// In the context of a "remote Alertmanager" it is a good heuristic for Grafana is about to shut down or we no longer need you.
func (am *Alertmanager) StopAndWait() {
	am.sender.Stop()
}

func (am *Alertmanager) Ready() bool {
	return am.ready
}

// CleanUp does not have an equivalent in a "remote Alertmanager" context, we don't have files on disk, no-op.
func (am *Alertmanager) CleanUp() {}

// shouldSendConfig compares the remote Alertmanager configuration with our local one.
// It returns true if the configurations are different.
func (am *Alertmanager) shouldSendConfig(ctx context.Context, rawConfig []byte) bool {
	rc, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
	if err != nil {
		// Log the error and return true so we try to upload our config anyway.
		am.log.Error("Unable to get the remote Alertmanager Configuration for comparison", "err", err)
		return true
	}

	return md5.Sum([]byte(rc.GrafanaAlertmanagerConfig)) != md5.Sum(rawConfig)
}

// shouldSendState compares the remote Alertmanager state with our local one.
// It returns true if the states are different.
func (am *Alertmanager) shouldSendState(ctx context.Context, state string) bool {
	rs, err := am.mimirClient.GetGrafanaAlertmanagerState(ctx)
	if err != nil {
		// Log the error and return true so we try to upload our state anyway.
		am.log.Error("Unable to get the remote Alertmanager state for comparison", "err", err)
		return true
	}

	return rs.State != state
}

package remote

import (
	"context"
	"crypto/md5"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	mimirClient "github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	amclient "github.com/prometheus/alertmanager/api/v2/client"
	amalert "github.com/prometheus/alertmanager/api/v2/client/alert"
	amalertgroup "github.com/prometheus/alertmanager/api/v2/client/alertgroup"
	amreceiver "github.com/prometheus/alertmanager/api/v2/client/receiver"
	amsilence "github.com/prometheus/alertmanager/api/v2/client/silence"
)

const readyPath = "/-/ready"

type stateStore interface {
	GetFullState(ctx context.Context) (string, error)
}

type Alertmanager struct {
	log      log.Logger
	orgID    int64
	tenantID string
	url      string

	amClient    *amclient.AlertmanagerAPI
	mimirClient mimirClient.MimirClient
	httpClient  *http.Client
	ready       bool
	sender      *sender.ExternalAlertmanager
	stateStore  stateStore
}

type AlertmanagerConfig struct {
	URL               string
	TenantID          string
	BasicAuthPassword string
}

func NewAlertmanager(cfg AlertmanagerConfig, orgID int64, kvstore kvstore.KVStore) (*Alertmanager, error) {
	client := http.Client{
		Transport: &mimirClient.MimirAuthRoundTripper{
			TenantID: cfg.TenantID,
			Password: cfg.BasicAuthPassword,
			Next:     http.DefaultTransport,
		},
	}

	if cfg.URL == "" {
		return nil, fmt.Errorf("empty remote Alertmanager URL for tenant '%s'", cfg.TenantID)
	}

	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse remote Alertmanager URL: %w", err)
	}

	logger := log.New("ngalert.remote.alertmanager")

	mcCfg := &mimirClient.Config{
		URL:      u,
		TenantID: cfg.TenantID,
		Password: cfg.BasicAuthPassword,
		Logger:   logger,
	}

	mc, err := mimirClient.New(mcCfg)
	if err != nil {
		return nil, err
	}

	u = u.JoinPath("/alertmanager", amclient.DefaultBasePath)
	transport := httptransport.NewWithClient(u.Host, u.Path, []string{u.Scheme}, &client)

	// Using our client with custom headers and basic auth credentials.
	doFunc := func(ctx context.Context, _ *http.Client, req *http.Request) (*http.Response, error) {
		return client.Do(req.WithContext(ctx))
	}
	s := sender.NewExternalAlertmanagerSender(sender.WithDoFunc(doFunc))
	s.Run()

	err = s.ApplyConfig(orgID, 0, []sender.ExternalAMcfg{{
		URL: cfg.URL + "/alertmanager",
	}})
	if err != nil {
		return nil, err
	}

	// We won't be handling files on disk, we can pass an empty string as workingDirPath.
	stateStore := notifier.NewFileStore(orgID, kvstore, "")
	return &Alertmanager{
		log:         logger,
		mimirClient: mc,
		amClient:    amclient.New(transport, nil),
		httpClient:  &client,
		sender:      s,
		stateStore:  stateStore,
		orgID:       orgID,
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
		am.log.Debug("Alertmanager previously marked as ready, skipping readiness check")
		return nil
	}

	// First, execute a readiness check to make sure the remote Alertmanager is ready.
	am.log.Debug("Start readiness check for remote Alertmanager", "url", am.url)
	if err := am.checkReadiness(ctx); err != nil {
		am.log.Error("unable to pass the readiness check", "err", err)
		return err
	}
	am.log.Debug("Completed readiness check for remote Alertmanager", "url", am.url)

	am.log.Debug("Start configuration upload to remote Alertmanager", "url", am.url)
	if ok := am.compareRemoteConfig(ctx, config); !ok {
		err := am.mimirClient.CreateGrafanaAlertmanagerConfig(ctx, config.AlertmanagerConfiguration, config.ConfigurationHash, config.ID, config.CreatedAt, config.Default)
		if err != nil {
			am.log.Error("Unable to upload the configuration to the remote Alertmanager", "err", err)
		} else {
			am.log.Debug("Completed configuration upload to remote Alertmanager", "url", am.url)
		}
	}

	am.log.Debug("Start state upload to remote Alertmanager", "url", am.url)
	if ok := am.compareRemoteState(ctx, ""); !ok {
		if err := am.mimirClient.CreateGrafanaAlertmanagerState(ctx, ""); err != nil {
			am.log.Error("Unable to upload the state to the remote Alertmanager", "err", err)
		}
	}
	am.log.Debug("Completed state upload to remote Alertmanager", "url", am.url)
	// upload the state

	return nil
}

func (am *Alertmanager) checkReadiness(ctx context.Context) error {
	readyURL := strings.TrimSuffix(am.url, "/") + "/alertmanager" + readyPath
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, readyURL, nil)
	if err != nil {
		return fmt.Errorf("error creating readiness request: %w", err)
	}

	res, err := am.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("error performing readiness check: %w", err)
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			am.log.Warn("Error closing response body", "err", err)
		}
	}()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("%w, status code: %d", notifier.ErrAlertmanagerNotReady, res.StatusCode)
	}

	// Wait for active senders.
	var attempts int
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			attempts++
			if len(am.sender.Alertmanagers()) > 0 {
				am.log.Debug("Alertmanager readiness check successful", "attempts", attempts)
				am.ready = true
				return nil
			}
		case <-time.After(10 * time.Second):
			return notifier.ErrAlertmanagerNotReady
		}
	}
}

func (am *Alertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	return nil
}

func (am *Alertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	return nil
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

	// Upload the configuration and state
}

func (am *Alertmanager) Ready() bool {
	return am.ready
}

// CleanUp does not have an equivalent in a "remote Alertmanager" context, we don't have files on disk, no-op.
func (am *Alertmanager) CleanUp() {}

// compareRemoteConfig gets the remote Alertmanager config and compares it to the existing configuration.
func (am *Alertmanager) compareRemoteConfig(ctx context.Context, config *models.AlertConfiguration) bool {
	rc, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
	if err != nil {
		// If we get an error trying to compare log it and return false so that we try to upload it anyway.
		am.log.Error("Unable to get the remote Alertmanager Configuration for comparison", "err", err)
		return false
	}

	return md5.Sum([]byte(rc.GrafanaAlertmanagerConfig)) == md5.Sum([]byte(config.AlertmanagerConfiguration))
}

// compareRemoteState gets the remote Alertmanager state and compares it to the existing state.
func (am *Alertmanager) compareRemoteState(ctx context.Context, state string) bool {
	rs, err := am.mimirClient.GetGrafanaAlertmanagerState(ctx)
	if err != nil {
		// If we get an error trying to compare log it and return false so that we try to upload it anyway.
		am.log.Error("Unable to get the remote Alertmanager state for comparison", "err", err)
		return false
	}

	return rs.State == state
}

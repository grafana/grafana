package remote

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	amclient "github.com/prometheus/alertmanager/api/v2/client"
	amalert "github.com/prometheus/alertmanager/api/v2/client/alert"
	amalertgroup "github.com/prometheus/alertmanager/api/v2/client/alertgroup"
	amreceiver "github.com/prometheus/alertmanager/api/v2/client/receiver"
	amsilence "github.com/prometheus/alertmanager/api/v2/client/silence"
)

const readyPath = "/-/ready"

type Alertmanager struct {
	log      log.Logger
	orgID    int64
	tenantID string
	url      string

	amClient   *amclient.AlertmanagerAPI
	httpClient *http.Client
	ready      bool
	sender     *sender.ExternalAlertmanager
}

type AlertmanagerConfig struct {
	URL               string
	TenantID          string
	BasicAuthPassword string
}

func NewAlertmanager(cfg AlertmanagerConfig, orgID int64) (*Alertmanager, error) {
	client := http.Client{
		Transport: &roundTripper{
			tenantID:          cfg.TenantID,
			basicAuthPassword: cfg.BasicAuthPassword,
			next:              http.DefaultTransport,
		},
	}

	if cfg.URL == "" {
		return nil, fmt.Errorf("empty URL for tenant %s", cfg.TenantID)
	}

	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, err
	}

	u = u.JoinPath(amclient.DefaultBasePath)
	transport := httptransport.NewWithClient(u.Host, u.Path, []string{u.Scheme}, &client)

	// Using our client with custom headers and basic auth credentials.
	doFunc := func(ctx context.Context, _ *http.Client, req *http.Request) (*http.Response, error) {
		return client.Do(req.WithContext(ctx))
	}
	s := sender.NewExternalAlertmanagerSender(sender.WithDoFunc(doFunc))
	s.Run()

	err = s.ApplyConfig(orgID, 0, []sender.ExternalAMcfg{{
		URL: cfg.URL,
	}})
	if err != nil {
		return nil, err
	}

	return &Alertmanager{
		amClient:   amclient.New(transport, nil),
		httpClient: &client,
		log:        log.New("ngalert.remote.alertmanager"),
		sender:     s,
		orgID:      orgID,
		tenantID:   cfg.TenantID,
		url:        cfg.URL,
	}, nil
}

func (am *Alertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	if am.ready {
		return nil
	}

	return am.checkReadiness(ctx)
}

func (am *Alertmanager) checkReadiness(ctx context.Context) error {
	readyURL := strings.TrimSuffix(am.url, "/") + readyPath
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

func (am *Alertmanager) StopAndWait() {
	am.sender.Stop()
}

func (am *Alertmanager) Ready() bool {
	return am.ready
}

// We don't have files on disk, no-op.
func (am *Alertmanager) CleanUp() {}

type roundTripper struct {
	tenantID          string
	basicAuthPassword string
	next              http.RoundTripper
}

// RoundTrip implements the http.RoundTripper interface
// while adding the `X-Scope-OrgID` header and basic auth credentials.
func (r *roundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("X-Scope-OrgID", r.tenantID)
	if r.tenantID != "" && r.basicAuthPassword != "" {
		req.SetBasicAuth(r.tenantID, r.basicAuthPassword)
	}

	return r.next.RoundTrip(req)
}

// TODO: change implementation, this is only useful for testing other methods.
func (am *Alertmanager) postConfig(ctx context.Context, rawConfig string) error {
	alertsURL := strings.TrimSuffix(am.url, "/alertmanager") + "/api/v1/alerts"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, alertsURL, strings.NewReader(rawConfig))
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	res, err := am.httpClient.Do(req)
	if err != nil {
		return err
	}

	if res.StatusCode == http.StatusNotFound {
		return fmt.Errorf("config not found")
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			am.log.Warn("Error while closing body", "err", err)
		}
	}()

	_, err = io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("error reading request response: %w", err)
	}

	if res.StatusCode != http.StatusCreated {
		return fmt.Errorf("setting config failed with status code %d", res.StatusCode)
	}
	return nil
}

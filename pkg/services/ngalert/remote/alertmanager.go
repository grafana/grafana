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
	amclient "github.com/prometheus/alertmanager/api/v2/client"
	amalert "github.com/prometheus/alertmanager/api/v2/client/alert"
	amalertgroup "github.com/prometheus/alertmanager/api/v2/client/alertgroup"
	amreceiver "github.com/prometheus/alertmanager/api/v2/client/receiver"
	amsilence "github.com/prometheus/alertmanager/api/v2/client/silence"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	defaultMaxQueueCapacity = 10000
	defaultTimeout          = 10 * time.Second
)

type Alertmanager struct {
	log           log.Logger
	url           string
	tenantID      string
	orgID         int64
	amClient      *amclient.AlertmanagerAPI
	manager       *Sender
	httpClient    *http.Client
	defaultConfig string
}

type AlertmanagerConfig struct {
	URL               string
	TenantID          string
	BasicAuthPassword string
	DefaultConfig     string
}

func NewAlertmanager(cfg AlertmanagerConfig, orgID int64, r prometheus.Registerer) (*Alertmanager, error) {
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

	_, err = notifier.Load([]byte(cfg.DefaultConfig))
	if err != nil {
		return nil, err
	}

	logger := log.New("ngalert.notifier.remote-alertmanager")
	amClient := amclient.New(transport, nil)

	manager := NewSender(
		&options{
			queueCapacity: defaultMaxQueueCapacity,
			registerer:    r,
			timeout:       defaultTimeout,
		},
		logger,
		amClient.Alert,
	)

	return &Alertmanager{
		amClient:      amClient,
		httpClient:    &client,
		log:           logger,
		url:           cfg.URL,
		tenantID:      cfg.TenantID,
		orgID:         orgID,
		defaultConfig: cfg.DefaultConfig,
		manager:       manager,
	}, nil
}

func (am *Alertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	return nil
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
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while putting alerts", "err", r)
		}
	}()

	if len(alerts.PostableAlerts) == 0 {
		return nil
	}

	as := make([]*alert, 0, len(alerts.PostableAlerts))
	for _, a := range alerts.PostableAlerts {
		na := am.alertToNotifierAlert(a)
		as = append(as, na)
	}

	am.manager.Send(as...)
	return nil
}

func (am *Alertmanager) alertToNotifierAlert(a amv2.PostableAlert) *alert {
	// Prometheus alertmanager has stricter rules for annotations/labels than grafana's internal alertmanager, so we sanitize invalid keys.
	return &alert{
		Labels:       am.sanitizeLabelSet(a.Alert.Labels),
		Annotations:  am.sanitizeLabelSet(a.Annotations),
		StartsAt:     time.Time(a.StartsAt),
		EndsAt:       time.Time(a.EndsAt),
		GeneratorURL: a.Alert.GeneratorURL.String(),
	}
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

// TODO: change implementation, this is only useful for testing other methods
func (am *Alertmanager) Ready() bool {
	readyURL := strings.TrimSuffix(am.url, "/") + "/-/ready"
	res, err := am.httpClient.Get(readyURL)
	if err != nil {
		return false
	}

	return res.StatusCode == http.StatusOK
}

func (am *Alertmanager) StopAndWait() {
	am.manager.Stop()
}

func (am *Alertmanager) FileStore() *notifier.FileStore {
	return &notifier.FileStore{}
}

func (am *Alertmanager) OrgID() int64 {
	return am.orgID
}

func (am *Alertmanager) ConfigHash() [16]byte {
	return [16]byte{}
}

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

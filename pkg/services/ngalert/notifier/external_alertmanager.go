package notifier

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	amclient "github.com/prometheus/alertmanager/api/v2/client"
	amalert "github.com/prometheus/alertmanager/api/v2/client/alert"
	amalertgroup "github.com/prometheus/alertmanager/api/v2/client/alertgroup"
	amsilence "github.com/prometheus/alertmanager/api/v2/client/silence"
	"github.com/prometheus/client_golang/prometheus"
)

type externalAlertmanager struct {
	log           log.Logger
	url           string
	tenantID      string
	orgID         int64
	amClient      *amclient.AlertmanagerAPI
	manager       *Manager
	httpClient    *http.Client
	defaultConfig string
}

type externalAlertmanagerConfig struct {
	URL               string
	TenantID          string
	BasicAuthPassword string
	DefaultConfig     string
}

func newExternalAlertmanager(cfg externalAlertmanagerConfig, orgID int64) (*externalAlertmanager, error) {
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

	_, err = Load([]byte(cfg.DefaultConfig))
	if err != nil {
		return nil, err
	}

	logger := log.New("ngalert.notifier.external-alertmanager")
	amClient := amclient.New(transport, nil)

	manager := NewManager(
		// Injecting a new registry here means these metrics are not exported.
		// Once we fix the individual Alertmanager metrics we should fix this scenario too.
		&options{
			queueCapacity: defaultMaxQueueCapacity,
			registerer:    prometheus.NewRegistry(),
			timeout:       defaultTimeout,
		},
		logger,
		amClient.Alert,
	)

	return &externalAlertmanager{
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

func (am *externalAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	return nil
}

func (am *externalAlertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	return nil
}

func (am *externalAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	return nil
}

func (am *externalAlertmanager) CreateSilence(ctx context.Context, silence *apimodels.PostableSilence) (string, error) {
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

func (am *externalAlertmanager) DeleteSilence(ctx context.Context, silenceID string) error {
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

func (am *externalAlertmanager) GetSilence(ctx context.Context, silenceID string) (apimodels.GettableSilence, error) {
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

func (am *externalAlertmanager) ListSilences(ctx context.Context, filter []string) (apimodels.GettableSilences, error) {
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

func (am *externalAlertmanager) GetAlerts(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
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

func (am *externalAlertmanager) GetAlertGroups(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
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

func (am *externalAlertmanager) PutAlerts(ctx context.Context, alerts apimodels.PostableAlerts) error {
	defer func() {
		if r := recover(); r != nil {
			am.log.Error("Panic while putting alerts", "err", r)
		}
	}()

	if len(alerts.PostableAlerts) == 0 {
		return nil
	}

	// TODO(santiago): is this really necessary?
	as := make([]*alert, 0, len(alerts.PostableAlerts))
	for _, a := range alerts.PostableAlerts {
		na := am.alertToNotifierAlert(a)
		as = append(as, na)
	}

	am.manager.Send(as...)
	return nil
}

func (am *externalAlertmanager) GetStatus() apimodels.GettableStatus {
	return apimodels.GettableStatus{}
}

func (am *externalAlertmanager) GetReceivers(ctx context.Context) []apimodels.Receiver {
	return []apimodels.Receiver{}
}

func (am *externalAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	return &TestReceiversResult{}, nil
}

func (am *externalAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error) {
	return &TestTemplatesResults{}, nil
}

func (am *externalAlertmanager) StopAndWait() {
	am.manager.Stop()
}

func (am *externalAlertmanager) Ready() bool {
	return false
}

func (am *externalAlertmanager) FileStore() *FileStore {
	return &FileStore{}
}

func (am *externalAlertmanager) OrgID() int64 {
	return am.orgID
}

func (am *externalAlertmanager) ConfigHash() [16]byte {
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

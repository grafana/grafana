package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	amclient "github.com/prometheus/alertmanager/api/v2/client"
	"gopkg.in/yaml.v3"
)

const configEndpoint = "/api/v1/alerts"

type configStore interface {
	SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

type externalAlertmanager struct {
	log           log.Logger
	url           string
	tenantID      string
	orgID         int64
	configStore   configStore
	amClient      *amclient.AlertmanagerAPI
	httpClient    *http.Client
	defaultConfig string
}

type externalAlertmanagerConfig struct {
	URL               string
	TenantID          string
	BasicAuthPassword string
	DefaultConfig     string
}

func newExternalAlertmanager(cfg externalAlertmanagerConfig, orgID int64, store configStore) (*externalAlertmanager, error) {
	client := http.Client{
		Transport: &roundTripper{
			tenantID:          cfg.TenantID,
			basicAuthPassword: cfg.BasicAuthPassword,
			next:              http.DefaultTransport,
		},
	}

	if cfg.URL == "" {
		return nil, errors.New("empty URL")
	}

	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, err
	}

	transport := httptransport.NewWithClient(u.Host, amclient.DefaultBasePath, []string{u.Scheme}, &client)

	_, err = Load([]byte(cfg.DefaultConfig))
	if err != nil {
		return nil, err
	}

	return &externalAlertmanager{
		amClient:      amclient.New(transport, nil),
		httpClient:    &client,
		configStore:   store,
		log:           log.New("ngalert.notifier.external-alertmanager"),
		url:           cfg.URL,
		tenantID:      cfg.TenantID,
		orgID:         orgID,
		defaultConfig: cfg.DefaultConfig,
	}, nil
}

func (am *externalAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	cfg, err := Load([]byte(config.AlertmanagerConfiguration))
	if err != nil {
		return err
	}

	return am.postConfig(ctx, cfg)
}

func (am *externalAlertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	if err := am.postConfig(ctx, cfg); err != nil {
		return err
	}
	return am.saveConfig(ctx, cfg, false)
}

func (am *externalAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	cfg, err := Load([]byte(am.defaultConfig))
	if err != nil {
		return err
	}

	if err := am.postConfig(ctx, cfg); err != nil {
		return err
	}

	return am.saveConfig(ctx, cfg, true)
}

func (am *externalAlertmanager) saveConfig(ctx context.Context, cfg *apimodels.PostableUserConfig, isDefault bool) error {
	b, err := json.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to serialize to the Alertmanager configuration: %w", err)
	}

	cmd := ngmodels.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(b),
		ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
		OrgID:                     am.orgID,
		LastApplied:               time.Now().UTC().Unix(),
		Default:                   isDefault,
	}
	return am.configStore.SaveAlertmanagerConfiguration(ctx, &cmd)
}

func (am *externalAlertmanager) postConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	b, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}

	url := strings.TrimSuffix(am.url, "/") + "/api/v1/alerts"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	am.log.Debug("Sending request to external Alertmanager", "url", url)
	res, err := am.httpClient.Do(req)
	if err != nil {
		return err
	}

	if res.StatusCode == http.StatusNotFound {
		return fmt.Errorf("config not found")
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			am.log.Warn("Failed to close response body", "err", err)
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

func (am *externalAlertmanager) GetStatus() (apimodels.GettableStatus, error) {
	return apimodels.GettableStatus{}, nil
}

func (am *externalAlertmanager) CreateSilence(*apimodels.PostableSilence) (string, error) {
	return "", nil
}

func (am *externalAlertmanager) DeleteSilence(string) error {
	return nil
}

func (am *externalAlertmanager) GetSilence(silenceID string) (apimodels.GettableSilence, error) {
	return apimodels.GettableSilence{}, nil
}

func (am *externalAlertmanager) ListSilences([]string) (apimodels.GettableSilences, error) {
	return apimodels.GettableSilences{}, nil
}

func (am *externalAlertmanager) GetAlerts(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	return apimodels.GettableAlerts{}, nil
}

func (am *externalAlertmanager) GetAlertGroups(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	return apimodels.AlertGroups{}, nil
}

func (am *externalAlertmanager) PutAlerts(postableAlerts apimodels.PostableAlerts) error {
	return nil
}

func (am *externalAlertmanager) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	return []apimodels.Receiver{}, nil
}

func (am *externalAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	return &TestReceiversResult{}, nil
}

func (am *externalAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error) {
	return &TestTemplatesResults{}, nil
}

func (am *externalAlertmanager) StopAndWait() {
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

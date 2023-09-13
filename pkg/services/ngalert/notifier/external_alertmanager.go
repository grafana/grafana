package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	amclient "github.com/prometheus/alertmanager/api/v2/client"
	"github.com/prometheus/alertmanager/api/v2/client/alert"
	"github.com/prometheus/alertmanager/api/v2/client/alertgroup"
	"github.com/prometheus/alertmanager/api/v2/client/general"
	"github.com/prometheus/alertmanager/api/v2/client/receiver"
	"github.com/prometheus/alertmanager/api/v2/client/silence"
	"gopkg.in/yaml.v3"
)

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

type ExternalAlertmanagerConfig struct {
	URL               string
	TenantID          string
	BasicAuthPassword string
	DefaultConfig     string
}

func newExternalAlertmanager(cfg ExternalAlertmanagerConfig, orgID int64, store configStore) (*externalAlertmanager, error) {
	client := http.Client{
		Transport: &roundTripper{
			tenantID:          cfg.TenantID,
			basicAuthPassword: cfg.BasicAuthPassword,
			next:              http.DefaultTransport,
		},
	}

	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, err
	}

	transport := httptransport.NewWithClient(u.Host, amclient.DefaultBasePath, []string{u.Scheme}, &client)

	return &externalAlertmanager{
		amClient:      amclient.New(transport, nil),
		httpClient:    &client,
		configStore:   store,
		log:           log.New("ngalert.notifier.external.alertmanager"),
		url:           cfg.URL,
		tenantID:      cfg.TenantID,
		orgID:         orgID,
		defaultConfig: cfg.DefaultConfig,
	}, nil
}

func (am *externalAlertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	fmt.Println("SaveAndApplyConfig() called")
	if err := am.postConfig(ctx, cfg); err != nil {
		return err
	}

	return am.saveConfig(ctx, cfg)
}

func (am *externalAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	fmt.Println("SaveAndApplyDefaultConfig() called")
	cfg, err := Load([]byte(am.defaultConfig))
	if err != nil {
		return err
	}

	if err := am.postConfig(ctx, cfg); err != nil {
		return err
	}

	return am.saveConfig(ctx, cfg)
}

func (am *externalAlertmanager) GetStatus() (apimodels.GettableStatus, error) {
	params := general.NewGetStatusParams()
	res, err := am.amClient.General.GetStatus(params)
	if err != nil {
		return apimodels.GettableStatus{}, err
	}

	status := res.Payload
	if err != nil {
		return apimodels.GettableStatus{}, err
	}
	grafanaStatus := apimodels.GettableStatus{
		Cluster: status.Cluster,
		Config:  &apimodels.PostableApiAlertingConfig{
			// TODO: parse config.
		},
		Uptime:      status.Uptime,
		VersionInfo: status.VersionInfo,
	}

	return grafanaStatus, nil
}

// Silences
func (am *externalAlertmanager) CreateSilence(*apimodels.PostableSilence) (string, error) {
	// TODO: silenceS? General?
	params := silence.NewPostSilencesParams()
	res, err := am.amClient.Silence.PostSilences(params)
	if err != nil {
		return "", err
	}

	return res.Payload.SilenceID, nil
}

func (am *externalAlertmanager) DeleteSilence(string) error {
	params := silence.NewDeleteSilenceParams()
	_, err := am.amClient.Silence.DeleteSilence(params)
	return err
}

func (am *externalAlertmanager) GetSilence(silenceID string) (apimodels.GettableSilence, error) {
	params := silence.NewGetSilenceParams()
	params.SilenceID = strfmt.UUID(silenceID)

	res, err := am.amClient.Silence.GetSilence(params)
	if err != nil {
		return apimodels.GettableSilence{}, err
	}

	return apimodels.GettableSilence{
		ID:        res.Payload.ID,
		Status:    res.Payload.Status,
		UpdatedAt: res.Payload.UpdatedAt,
		Silence:   res.Payload.Silence,
	}, nil
}

func (am *externalAlertmanager) ListSilences([]string) (apimodels.GettableSilences, error) {
	params := silence.NewGetSilencesParams()
	res, err := am.amClient.Silence.GetSilences(params)
	if err != nil {
		return apimodels.GettableSilences{}, err
	}

	return res.Payload, err
}

func (am *externalAlertmanager) GetAlerts(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	params := alert.NewGetAlertsParams()
	res, err := am.amClient.Alert.GetAlerts(params)
	if err != nil {
		return nil, err
	}

	return res.Payload, nil
}

func (am *externalAlertmanager) GetAlertGroups(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	params := alertgroup.NewGetAlertGroupsParams()
	res, err := am.amClient.Alertgroup.GetAlertGroups(params)
	if err != nil {
		return nil, err
	}

	return res.Payload, nil
}

func (am *externalAlertmanager) PutAlerts(postableAlerts apimodels.PostableAlerts) error {
	params := alert.NewPostAlertsParams()
	_, err := am.amClient.Alert.PostAlerts(params)
	return err
}

func (am *externalAlertmanager) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	params := receiver.NewGetReceiversParams()
	res, err := am.amClient.Receiver.GetReceivers(params)
	if err != nil {
		return []apimodels.Receiver{}, err
	}

	// TODO: turn into receiver...
	rcvs := res.Payload
	grafanaRcvs := make([]apimodels.Receiver, 0, len(rcvs))
	for _, rcv := range rcvs {
		grafanaRcvs = append(grafanaRcvs, apimodels.Receiver{
			Active:       rcv.Active,
			Integrations: rcv.Integrations,
			Name:         rcv.Name,
		})
	}

	return grafanaRcvs, nil
}

func (am *externalAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	fmt.Println("ApplyConfig() called")
	cfg, err := Load([]byte(config.AlertmanagerConfiguration))
	if err != nil {
		return err
	}

	return am.postConfig(ctx, cfg)
}

func (am *externalAlertmanager) postConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	b, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}

	fmt.Printf("Sending request to URL %s with payload %s\n", am.url+"/api/v1/alerts", string(b))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, am.url+"/api/v1/alerts", bytes.NewReader(b))
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
			am.log.Warn("Failed to close response body", "err", err)
		}
	}()

	resBody, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("error reading request response: %w", err)
	}

	if res.StatusCode != http.StatusCreated {
		return fmt.Errorf("setting config failed with status code %d and error %v", res.StatusCode, string(resBody))
	}
	return nil
}

func (am *externalAlertmanager) saveConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	b, err := json.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to serialize to the Alertmanager configuration: %w", err)
	}

	cmd := ngmodels.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(b),
		ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
		OrgID:                     am.orgID,
		LastApplied:               time.Now().UTC().Unix(),
	}
	return am.configStore.SaveAlertmanagerConfiguration(ctx, &cmd)
}

// TODO: implement!
func (am *externalAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	return nil, fmt.Errorf("Testing of receivers not implemented")
}

// TODO: implement!
func (am *externalAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error) {
	return nil, fmt.Errorf("Testing of templates not implemented")
}

// TODO: implement!
func (am *externalAlertmanager) StopAndWait() {
}

// TODO: implement!
func (am *externalAlertmanager) Ready() bool {
	return false
}

// TODO: implement!
func (am *externalAlertmanager) FileStore() *FileStore {
	return &FileStore{}
}

func (am *externalAlertmanager) OrgID() int64 {
	return am.orgID
}

// TODO: implement!
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

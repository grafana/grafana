// Copied from Mimir.
// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/cortexproject/cortex/blob/master/integration/e2ecortex/client.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Cortex Authors.

package e2emimir

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/prometheus/alertmanager/types"
	promapi "github.com/prometheus/client_golang/api"
	"github.com/prometheus/common/model"
	yaml "gopkg.in/yaml.v3"
)

var ErrNotFound = errors.New("not found")

// Client is a client used to interact with Mimir in integration tests
// NOTE(santiago): otro client, este se usa en tests pero...
type Client struct {
	alertmanagerClient  promapi.Client
	alertmanagerAddress string
	timeout             time.Duration
	httpClient          *http.Client
	orgID               string
}

// NewClient makes a new Mimir client
func NewClient(
	alertmanagerAddress string,
	orgID string,
) (*Client, error) {
	c := &Client{
		alertmanagerAddress: alertmanagerAddress,
		timeout:             5 * time.Second,
		httpClient:          &http.Client{},
		orgID:               orgID,
	}

	if alertmanagerAddress != "" {
		alertmanagerAPIClient, err := promapi.NewClient(promapi.Config{
			Address:      alertmanagerAddress,
			RoundTripper: &addOrgIDRoundTripper{orgID: orgID, next: http.DefaultTransport},
		})
		if err != nil {
			return nil, err
		}
		c.alertmanagerClient = alertmanagerAPIClient
	}

	return c, nil
}

type addOrgIDRoundTripper struct {
	orgID string
	next  http.RoundTripper
}

func (r *addOrgIDRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("X-Scope-OrgID", r.orgID)

	return r.next.RoundTrip(req)
}

// ServerStatus represents a Alertmanager status response
// TODO: Upgrade to Alertmanager v0.20.0+ and utilize vendored structs
type ServerStatus struct {
	Data struct {
		ConfigYaml string `json:"configYAML"`
	} `json:"data"`
}

// userConfig is used to communicate a users alertmanager configs
type userConfig struct {
	TemplateFiles      map[string]string `yaml:"template_files"`
	AlertmanagerConfig string            `yaml:"alertmanager_config"`
}

// GetAlertmanagerStatusPage gets the status page of alertmanager.
func (c *Client) GetAlertmanagerStatusPage(ctx context.Context) ([]byte, error) {
	return c.getRawPage(ctx, "http://"+c.alertmanagerAddress+"/multitenant_alertmanager/status")
}

func (c *Client) getRawPage(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("fetching page failed with status %d and content %v", resp.StatusCode, string(content))
	}
	return content, nil
}

// GetAlertmanager performs a GET request on a per-tenant alertmanager endpoint.
func (c *Client) GetAlertmanager(ctx context.Context, path string) (string, error) {
	return c.doAlertmanagerRequest(ctx, http.MethodGet, path)
}

// PostAlertmanager performs a POST request on a per-tenant alertmanager endpoint.
func (c *Client) PostAlertmanager(ctx context.Context, path string) error {
	_, err := c.doAlertmanagerRequest(ctx, http.MethodPost, path)
	return err
}

func (c *Client) doAlertmanagerRequest(ctx context.Context, method string, path string) (string, error) {
	u := c.alertmanagerClient.URL(fmt.Sprintf("alertmanager/%s", path), nil)

	req, err := http.NewRequest(method, u.String(), nil)
	if err != nil {
		return "", fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return "", err
	}

	if resp.StatusCode == http.StatusNotFound {
		return "", ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("getting %s failed with status %d and error %v", path, resp.StatusCode, string(body))
	}
	return string(body), nil
}

// GetAlertmanagerConfig gets the Alertmanager configuration for a tenant.
func (c *Client) GetAlertmanagerConfig(ctx context.Context) (apimodels.GettableUserConfig, error) {
	u := c.alertmanagerClient.URL("/api/v1/alerts", nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return apimodels.GettableUserConfig{}, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return apimodels.GettableUserConfig{}, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return apimodels.GettableUserConfig{}, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return apimodels.GettableUserConfig{}, fmt.Errorf("getting config failed with status %d and error %v", resp.StatusCode, string(body))
	}

	var cfg apimodels.GettableUserConfig
	err = yaml.Unmarshal(body, &cfg)

	return cfg, err
}

// SetAlertmanagerConfig sets the Alertmanager configuration for a tenant.
func (c *Client) SetAlertmanagerConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	u := c.alertmanagerClient.URL("/api/v1/alerts", nil)

	data, err := yaml.Marshal(config)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("setting config failed with status %d and error %v", resp.StatusCode, string(body))
	}

	return nil
}

// DeleteAlertmanagerConfig gets the status of an alertmanager instance
func (c *Client) DeleteAlertmanagerConfig(ctx context.Context) error {
	u := c.alertmanagerClient.URL("/api/v1/alerts", nil)
	req, err := http.NewRequest(http.MethodDelete, u.String(), nil)
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("deleting config failed with status %d and error %v", resp.StatusCode, string(body))
	}

	return nil
}

// SendAlertToAlermanager sends alerts to the Alertmanager API
func (c *Client) SendAlertToAlermanager(ctx context.Context, alert *model.Alert) error {
	u := c.alertmanagerClient.URL("/alertmanager/api/v1/alerts", nil)

	data, err := json.Marshal([]types.Alert{{Alert: *alert}})
	if err != nil {
		return fmt.Errorf("error marshaling the alert: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("sending alert failed with status %d and error %v", resp.StatusCode, string(body))
	}

	return nil
}

func (c *Client) GetAlertsV1(ctx context.Context) ([]model.Alert, error) {
	u := c.alertmanagerClient.URL("alertmanager/api/v1/alerts", nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("getting alerts failed with status %d and error %v", resp.StatusCode, string(body))
	}

	type response struct {
		Status string        `json:"status"`
		Data   []model.Alert `json:"data"`
	}

	decoded := &response{}
	if err := json.Unmarshal(body, decoded); err != nil {
		return nil, err
	}

	if decoded.Status != "success" {
		return nil, fmt.Errorf("unexpected response status '%s'", decoded.Status)
	}

	return decoded.Data, nil
}

func (c *Client) GetAlertsV2(ctx context.Context) ([]model.Alert, error) {
	u := c.alertmanagerClient.URL("alertmanager/api/v2/alerts", nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("getting alerts failed with status %d and error %v", resp.StatusCode, string(body))
	}

	decoded := []model.Alert{}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, err
	}

	return decoded, nil
}

type AlertGroup struct {
	Labels model.LabelSet `json:"labels"`
	Alerts []model.Alert  `json:"alerts"`
}

func (c *Client) GetAlertGroups(ctx context.Context) ([]AlertGroup, error) {
	u := c.alertmanagerClient.URL("alertmanager/api/v2/alerts/groups", nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("getting alert groups failed with status %d and error %v", resp.StatusCode, string(body))
	}

	decoded := []AlertGroup{}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, err
	}
	return decoded, nil
}

// CreateSilence creates a new silence and returns the unique identifier of the silence.
func (c *Client) CreateSilence(ctx context.Context, silence types.Silence) (string, error) {
	u := c.alertmanagerClient.URL("alertmanager/api/v1/silences", nil)

	data, err := json.Marshal(silence)
	if err != nil {
		return "", fmt.Errorf("error marshaling the silence: %s", err)
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("creating the silence failed with status %d and error %v", resp.StatusCode, string(body))
	}

	type response struct {
		Status string `json:"status"`
		Data   struct {
			SilenceID string `json:"silenceID"`
		} `json:"data"`
	}

	decoded := &response{}
	if err := json.Unmarshal(body, decoded); err != nil {
		return "", err
	}

	if decoded.Status != "success" {
		return "", fmt.Errorf("unexpected response status '%s'", decoded.Status)
	}

	return decoded.Data.SilenceID, nil
}

func (c *Client) GetSilencesV1(ctx context.Context) ([]types.Silence, error) {
	u := c.alertmanagerClient.URL("alertmanager/api/v1/silences", nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("getting silences failed with status %d and error %v", resp.StatusCode, string(body))
	}

	type response struct {
		Status string          `json:"status"`
		Data   []types.Silence `json:"data"`
	}

	decoded := &response{}
	if err := json.Unmarshal(body, decoded); err != nil {
		return nil, err
	}

	if decoded.Status != "success" {
		return nil, fmt.Errorf("unexpected response status '%s'", decoded.Status)
	}

	return decoded.Data, nil
}

func (c *Client) GetSilencesV2(ctx context.Context) (apimodels.GettableSilences, error) {
	u := c.alertmanagerClient.URL("alertmanager/api/v2/silences", nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("getting silences failed with status %d and error %v", resp.StatusCode, string(body))
	}

	var decoded apimodels.GettableSilences
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, err
	}

	return decoded, nil
}

func (c *Client) GetSilenceV1(ctx context.Context, id string) (types.Silence, error) {
	u := c.alertmanagerClient.URL(fmt.Sprintf("alertmanager/api/v1/silence/%s", url.PathEscape(id)), nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return types.Silence{}, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return types.Silence{}, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return types.Silence{}, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return types.Silence{}, fmt.Errorf("getting silence failed with status %d and error %v", resp.StatusCode, string(body))
	}

	type response struct {
		Status string        `json:"status"`
		Data   types.Silence `json:"data"`
	}

	decoded := &response{}
	if err := json.Unmarshal(body, decoded); err != nil {
		return types.Silence{}, err
	}

	if decoded.Status != "success" {
		return types.Silence{}, fmt.Errorf("unexpected response status '%s'", decoded.Status)
	}

	return decoded.Data, nil
}

func (c *Client) GetSilenceV2(ctx context.Context, id string) (types.Silence, error) {
	u := c.alertmanagerClient.URL(fmt.Sprintf("alertmanager/api/v2/silence/%s", url.PathEscape(id)), nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return types.Silence{}, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return types.Silence{}, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return types.Silence{}, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return types.Silence{}, fmt.Errorf("getting silence failed with status %d and error %v", resp.StatusCode, string(body))
	}

	decoded := types.Silence{}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return types.Silence{}, err
	}

	return decoded, nil
}

func (c *Client) DeleteSilence(ctx context.Context, id string) error {
	u := c.alertmanagerClient.URL(fmt.Sprintf("alertmanager/api/v1/silence/%s", url.PathEscape(id)), nil)

	req, err := http.NewRequest(http.MethodDelete, u.String(), nil)
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("deleting silence failed with status %d and error %v", resp.StatusCode, string(body))
	}

	return nil
}

func (c *Client) GetReceivers(ctx context.Context) ([]string, error) {
	u := c.alertmanagerClient.URL("alertmanager/api/v1/receivers", nil)

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	resp, body, err := c.alertmanagerClient.Do(ctx, req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("getting receivers failed with status %d and error %v", resp.StatusCode, string(body))
	}

	type response struct {
		Status string   `json:"status"`
		Data   []string `json:"data"`
	}

	decoded := &response{}
	if err := json.Unmarshal(body, decoded); err != nil {
		return nil, err
	}

	if decoded.Status != "success" {
		return nil, fmt.Errorf("unexpected response status '%s'", decoded.Status)
	}

	return decoded.Data, nil
}

// DoGet performs a HTTP GET request towards the supplied URL. The request
// contains the X-Scope-OrgID header and the timeout configured by the client
// object.
func (c *Client) DoGet(url string) (*http.Response, error) {
	return c.doRequest("GET", url, nil)
}

// DoGetBody performs a HTTP GET request towards the supplied URL and returns
// the full response body. The request contains the X-Scope-OrgID header and
// the timeout configured by the client object.
func (c *Client) DoGetBody(url string) (*http.Response, []byte, error) {
	resp, err := c.DoGet(url)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}

	return resp, body, nil
}

// DoPost performs a HTTP POST request towards the supplied URL and using the
// given request body. The request contains the X-Scope-OrgID header and the
// timeout configured by the client object.
func (c *Client) DoPost(url string, body io.Reader) (*http.Response, error) {
	return c.doRequest("POST", url, body)
}

func (c *Client) doRequest(method, url string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Scope-OrgID", c.orgID)

	client := *c.httpClient
	client.Timeout = c.timeout

	return client.Do(req)
}

// FormatTime converts a time to a string acceptable by the Prometheus API.
func FormatTime(t time.Time) string {
	return strconv.FormatFloat(float64(t.Unix())+float64(t.Nanosecond())/1e9, 'f', -1, 64)
}

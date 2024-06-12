package gcom

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

const LogPrefix = "gcom.service"

var ErrTokenNotFound = errors.New("gcom: token not found")

type Service interface {
	GetInstanceByID(ctx context.Context, requestID string, instanceID string) (Instance, error)
	CreateAccessPolicy(ctx context.Context, params CreateAccessPolicyParams, payload CreateAccessPolicyPayload) (AccessPolicy, error)
	ListAccessPolicies(ctx context.Context, params ListAccessPoliciesParams) ([]AccessPolicy, error)
	DeleteAccessPolicy(ctx context.Context, params DeleteAccessPolicyParams) (bool, error)
	ListTokens(ctx context.Context, params ListTokenParams) ([]TokenView, error)
	CreateToken(ctx context.Context, params CreateTokenParams, payload CreateTokenPayload) (Token, error)
	DeleteToken(ctx context.Context, params DeleteTokenParams) error
}

type Instance struct {
	ID          int    `json:"id"`
	Slug        string `json:"slug"`
	RegionSlug  string `json:"regionSlug"`
	ClusterSlug string `json:"clusterSlug"`
}

type CreateAccessPolicyParams struct {
	RequestID string
	Region    string
}

type CreateAccessPolicyPayload struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"displayName"`
	Realms      []Realm  `json:"realms"`
	Scopes      []string `json:"scopes"`
}

type Realm struct {
	Identifier    string        `json:"identifier"`
	LabelPolicies []LabelPolicy `json:"labelPolicies"`
	Type          string        `json:"type"`
}

type LabelPolicy struct {
	Selector string `json:"selector"`
}

type AccessPolicy struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ListAccessPoliciesParams struct {
	RequestID string
	Region    string
	Name      string
}

type ListAccessPoliciesResponse struct {
	Items []AccessPolicy `json:"items"`
}

type DeleteAccessPolicyParams struct {
	RequestID      string
	AccessPolicyID string
	Region         string
}

type ListTokenParams struct {
	RequestID        string
	Region           string
	AccessPolicyName string
	TokenName        string
}

type CreateTokenParams struct {
	RequestID string
	Region    string
}

type CreateTokenPayload struct {
	AccessPolicyID string    `json:"accessPolicyId"`
	DisplayName    string    `json:"displayName"`
	Name           string    `json:"name"`
	ExpiresAt      time.Time `json:"expiresAt"`
}

// The token returned by gcom api when a token gets created.
type Token struct {
	ID             string `json:"id"`
	AccessPolicyID string `json:"accessPolicyId"`
	Name           string `json:"name"`
	Token          string `json:"token"`
}

type DeleteTokenParams struct {
	RequestID string
	Region    string
	TokenID   string
}

// The token returned by gcom api for a GET token request.
type TokenView struct {
	ID             string `json:"id"`
	AccessPolicyID string `json:"accessPolicyId"`
	Name           string `json:"name"`
	DisplayName    string `json:"displayName"`
	ExpiresAt      string `json:"expiresAt"`
	FirstUsedAt    string `json:"firstUsedAt"`
	LastUsedAt     string `json:"lastUsedAt"`
	CreatedAt      string `json:"createdAt"`
}

type listTokensResponse struct {
	Items []TokenView `json:"items"`
}

type GcomClient struct {
	log        log.Logger
	cfg        Config
	httpClient *http.Client
}

type Config struct {
	ApiURL string
	Token  string
}

func New(cfg Config) Service {
	return &GcomClient{
		log:        log.New(LogPrefix),
		cfg:        cfg,
		httpClient: &http.Client{},
	}
}

func (client *GcomClient) GetInstanceByID(ctx context.Context, requestID string, instanceID string) (Instance, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/instances/", instanceID)
	if err != nil {
		return Instance{}, fmt.Errorf("building gcom instance url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Instance{}, fmt.Errorf("creating http request: %w", err)
	}

	request.Header.Set("x-request-id", requestID)
	request.Header.Set("Content-Type", "application/json")

	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return Instance{}, fmt.Errorf("sending http request to create fetch instance by id: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return Instance{}, fmt.Errorf("unexpected response when fetching instance by id: code=%d body=%s", response.StatusCode, body)
	}

	var instance Instance
	if err := json.NewDecoder(response.Body).Decode(&instance); err != nil {
		return instance, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return instance, nil
}

func (client *GcomClient) CreateAccessPolicy(ctx context.Context, params CreateAccessPolicyParams, payload CreateAccessPolicyPayload) (AccessPolicy, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/accesspolicies")
	if err != nil {
		return AccessPolicy{}, fmt.Errorf("building gcom access policy url: %w", err)
	}

	body, err := json.Marshal(&payload)
	if err != nil {
		return AccessPolicy{}, fmt.Errorf("marshaling request body: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return AccessPolicy{}, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
	query.Set("region", params.Region)

	request.URL.RawQuery = query.Encode()
	request.Header.Set("x-request-id", params.RequestID)
	request.Header.Set("Content-Type", "application/json")

	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return AccessPolicy{}, fmt.Errorf("sending http request to create access policy: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return AccessPolicy{}, fmt.Errorf("unexpected response when creating access policy: code=%d body=%s", response.StatusCode, body)
	}

	var accessPolicy AccessPolicy
	if err := json.NewDecoder(response.Body).Decode(&accessPolicy); err != nil {
		return accessPolicy, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return accessPolicy, nil
}

func (client *GcomClient) DeleteAccessPolicy(ctx context.Context, params DeleteAccessPolicyParams) (bool, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/accesspolicies/", params.AccessPolicyID)
	if err != nil {
		return false, fmt.Errorf("building gcom access policy url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return false, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
	query.Set("region", params.Region)

	request.URL.RawQuery = query.Encode()
	request.Header.Set("x-request-id", params.RequestID)
	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return false, fmt.Errorf("sending http request to create access policy: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode == http.StatusNotFound {
		return false, nil
	}

	if response.StatusCode == http.StatusOK || response.StatusCode == http.StatusNoContent {
		return true, nil
	}

	body, _ := io.ReadAll(response.Body)
	return false, fmt.Errorf("unexpected response when deleting access policy: code=%d body=%s", response.StatusCode, body)
}

func (client *GcomClient) ListAccessPolicies(ctx context.Context, params ListAccessPoliciesParams) ([]AccessPolicy, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/accesspolicies")
	if err != nil {
		return nil, fmt.Errorf("building gcom access policy url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
	query.Set("region", params.Region)
	query.Set("name", params.Name)
	request.URL.RawQuery = query.Encode()
	request.Header.Set("x-request-id", params.RequestID)
	request.Header.Set("Accept", "application/json")

	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("sending http request to create access policy: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return nil, fmt.Errorf("unexpected response when listing access policies: code=%d body=%s", response.StatusCode, body)
	}

	var responseBody ListAccessPoliciesResponse
	if err := json.NewDecoder(response.Body).Decode(&responseBody); err != nil {
		return responseBody.Items, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return responseBody.Items, nil
}

func (client *GcomClient) ListTokens(ctx context.Context, params ListTokenParams) ([]TokenView, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/tokens")
	if err != nil {
		return nil, fmt.Errorf("building gcom tokens url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
	query.Set("region", params.Region)
	query.Set("accessPolicyName", params.AccessPolicyName)
	query.Set("name", params.TokenName)

	request.URL.RawQuery = query.Encode()
	request.Header.Set("x-request-id", params.RequestID)
	request.Header.Set("Content-Type", "application/json")

	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("sending http request to list access tokens: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return nil, fmt.Errorf("unexpected response when fetching access tokens: code=%d body=%s", response.StatusCode, body)
	}

	var body listTokensResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return body.Items, nil
}
func (client *GcomClient) CreateToken(ctx context.Context, params CreateTokenParams, payload CreateTokenPayload) (Token, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/tokens")
	if err != nil {
		return Token{}, fmt.Errorf("building gcom tokens url: %w", err)
	}

	body, err := json.Marshal(&payload)
	if err != nil {
		return Token{}, fmt.Errorf("marshaling request body: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return Token{}, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
	query.Set("region", params.Region)

	request.URL.RawQuery = query.Encode()
	request.Header.Set("x-request-id", params.RequestID)
	request.Header.Set("Content-Type", "application/json")

	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return Token{}, fmt.Errorf("sending http request to create access token: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return Token{}, fmt.Errorf("unexpected response when creating access token: code=%d body=%s", response.StatusCode, body)
	}

	var token Token
	if err := json.NewDecoder(response.Body).Decode(&token); err != nil {
		return token, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return token, nil
}

func (client *GcomClient) DeleteToken(ctx context.Context, params DeleteTokenParams) error {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/tokens", params.TokenID)
	if err != nil {
		return fmt.Errorf("building gcom tokens url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
	query.Set("region", params.Region)

	request.URL.RawQuery = query.Encode()
	request.Header.Set("x-request-id", params.RequestID)
	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("sending http request to delete access token: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode == http.StatusNotFound {
		return fmt.Errorf("token id: %s %w", params.TokenID, ErrTokenNotFound)
	}

	if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(response.Body)
		return fmt.Errorf("unexpected response when deleting access token: code=%d body=%s", response.StatusCode, body)
	}

	return nil
}

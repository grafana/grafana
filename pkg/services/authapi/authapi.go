// Package authapi contains the connector for Grafana internal auth service. This can be used instead of the GCOM service
// to create access policies and access tokens
package authapi

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

const LogPrefix = "auth-api.service"

var ErrTokenNotFound = errors.New("auth-api: token not found")

type Service interface {
	CreateAccessPolicy(ctx context.Context, params CreateAccessPolicyParams, payload CreateAccessPolicyPayload) (AccessPolicy, error)
	ListAccessPolicies(ctx context.Context, params ListAccessPoliciesParams) ([]AccessPolicy, error)
	DeleteAccessPolicy(ctx context.Context, params DeleteAccessPolicyParams) (bool, error)
	ListTokens(ctx context.Context, params ListTokenParams) ([]TokenView, error)
	CreateToken(ctx context.Context, params CreateTokenParams, payload CreateTokenPayload) (Token, error)
	DeleteToken(ctx context.Context, params DeleteTokenParams) error
}

type CreateAccessPolicyParams struct {
	RequestID string
	// this is needed until we fully migrate from gcom to authapi
	Region string
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

type createAccessPolicyResponse struct {
	Data AccessPolicy `json:"data"`
}

type AccessPolicy struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ListAccessPoliciesParams struct {
	RequestID string
	Name      string
	// this is needed until we fully migrate from gcom to authapi
	Region string
}

type listAccessPoliciesResponse struct {
	Data []AccessPolicy `json:"data"`
}

type DeleteAccessPolicyParams struct {
	RequestID      string
	AccessPolicyID string
	// this is needed until we fully migrate from gcom to authapi
	Region string
}

type ListTokenParams struct {
	RequestID        string
	AccessPolicyName string
	TokenName        string
	// this is needed until we fully migrate from gcom to authapi
	Region string
}

type CreateTokenParams struct {
	RequestID string
	// this is needed until we fully migrate from gcom to authapi
	Region string
}

type CreateTokenPayload struct {
	AccessPolicyID string    `json:"accessPolicyId"`
	DisplayName    string    `json:"displayName"`
	Name           string    `json:"name"`
	ExpiresAt      time.Time `json:"expiresAt"`
}

type createTokenResponse struct {
	Data Token `json:"data"`
}

// Token returned by authapi api when a token gets created.
type Token struct {
	ID             string `json:"id"`
	AccessPolicyID string `json:"accessPolicyId"`
	Name           string `json:"name"`
	Token          string `json:"token"`
}

type DeleteTokenParams struct {
	RequestID string
	TokenID   string
	// this is needed until we fully migrate from gcom to authapi
	Region string
}

// TokenView returned by authapi api for a GET token request.
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
	Data []TokenView `json:"data"`
}

var _ Service = (*AuthApiClient)(nil)

type AuthApiClient struct {
	log        log.Logger
	cfg        Config
	httpClient *http.Client
}

type Config struct {
	ApiURL string
	Token  string
}

func New(cfg Config, httpClient *http.Client) Service {
	return &AuthApiClient{
		log:        log.New(LogPrefix),
		cfg:        cfg,
		httpClient: httpClient,
	}
}

func (client *AuthApiClient) CreateAccessPolicy(ctx context.Context, params CreateAccessPolicyParams, payload CreateAccessPolicyPayload) (AccessPolicy, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/accesspolicies")
	if err != nil {
		return AccessPolicy{}, fmt.Errorf("building authapi access policy url: %w", err)
	}

	body, err := json.Marshal(&payload)
	if err != nil {
		return AccessPolicy{}, fmt.Errorf("marshaling request body: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return AccessPolicy{}, fmt.Errorf("creating http request: %w", err)
	}

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

	var capResp createAccessPolicyResponse
	if err := json.NewDecoder(response.Body).Decode(&capResp); err != nil {
		return AccessPolicy{}, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return capResp.Data, nil
}

func (client *AuthApiClient) DeleteAccessPolicy(ctx context.Context, params DeleteAccessPolicyParams) (bool, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/accesspolicies/", params.AccessPolicyID)
	if err != nil {
		return false, fmt.Errorf("building authapi access policy url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return false, fmt.Errorf("creating http request: %w", err)
	}

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

func (client *AuthApiClient) ListAccessPolicies(ctx context.Context, params ListAccessPoliciesParams) ([]AccessPolicy, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/accesspolicies")
	if err != nil {
		return nil, fmt.Errorf("building authapi access policy url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
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

	var lapResp listAccessPoliciesResponse
	if err := json.NewDecoder(response.Body).Decode(&lapResp); err != nil {
		return lapResp.Data, fmt.Errorf("unmarshaling response body: %w", err)
	}
	return lapResp.Data, nil
}

func (client *AuthApiClient) ListTokens(ctx context.Context, params ListTokenParams) ([]TokenView, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/tokens")
	if err != nil {
		return nil, fmt.Errorf("building authapi tokens url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
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
	return body.Data, nil
}

func (client *AuthApiClient) CreateToken(ctx context.Context, params CreateTokenParams, payload CreateTokenPayload) (Token, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/tokens")
	if err != nil {
		return Token{}, fmt.Errorf("building authapi tokens url: %w", err)
	}

	body, err := json.Marshal(&payload)
	if err != nil {
		return Token{}, fmt.Errorf("marshaling request body: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return Token{}, fmt.Errorf("creating http request: %w", err)
	}

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

	var ctResp createTokenResponse
	if err := json.NewDecoder(response.Body).Decode(&ctResp); err != nil {
		return Token{}, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return ctResp.Data, nil
}

func (client *AuthApiClient) DeleteToken(ctx context.Context, params DeleteTokenParams) error {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/tokens", params.TokenID)
	if err != nil {
		return fmt.Errorf("building authapi tokens url: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return fmt.Errorf("creating http request: %w", err)
	}

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

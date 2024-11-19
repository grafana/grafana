package gcom

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/services/authapi"
)

// this will be removed when service in authapi is fully enabled

type listTokensResponse struct {
	Items []authapi.TokenView `json:"items"`
}

type listAccessPoliciesResponse struct {
	Items []authapi.AccessPolicy `json:"items"`
}

var _ authapi.Service = (*GcomClient)(nil)

func (client *GcomClient) CreateAccessPolicy(ctx context.Context, params authapi.CreateAccessPolicyParams, payload authapi.CreateAccessPolicyPayload) (authapi.AccessPolicy, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/accesspolicies")
	if err != nil {
		return authapi.AccessPolicy{}, fmt.Errorf("building gcom access policy url: %w", err)
	}

	body, err := json.Marshal(&payload)
	if err != nil {
		return authapi.AccessPolicy{}, fmt.Errorf("marshaling request body: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return authapi.AccessPolicy{}, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
	query.Set("region", params.Region)

	request.URL.RawQuery = query.Encode()
	request.Header.Set("x-request-id", params.RequestID)
	request.Header.Set("Content-Type", "application/json")

	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return authapi.AccessPolicy{}, fmt.Errorf("sending http request to create access policy: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return authapi.AccessPolicy{}, fmt.Errorf("unexpected response when creating access policy: code=%d body=%s", response.StatusCode, body)
	}

	var accessPolicy authapi.AccessPolicy
	if err := json.NewDecoder(response.Body).Decode(&accessPolicy); err != nil {
		return accessPolicy, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return accessPolicy, nil
}

func (client *GcomClient) DeleteAccessPolicy(ctx context.Context, params authapi.DeleteAccessPolicyParams) (bool, error) {
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

func (client *GcomClient) ListAccessPolicies(ctx context.Context, params authapi.ListAccessPoliciesParams) ([]authapi.AccessPolicy, error) {
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

	var responseBody listAccessPoliciesResponse
	if err := json.NewDecoder(response.Body).Decode(&responseBody); err != nil {
		return responseBody.Items, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return responseBody.Items, nil
}

func (client *GcomClient) ListTokens(ctx context.Context, params authapi.ListTokenParams) ([]authapi.TokenView, error) {
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

func (client *GcomClient) CreateToken(ctx context.Context, params authapi.CreateTokenParams, payload authapi.CreateTokenPayload) (authapi.Token, error) {
	endpoint, err := url.JoinPath(client.cfg.ApiURL, "/v1/tokens")
	if err != nil {
		return authapi.Token{}, fmt.Errorf("building gcom tokens url: %w", err)
	}

	body, err := json.Marshal(&payload)
	if err != nil {
		return authapi.Token{}, fmt.Errorf("marshaling request body: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return authapi.Token{}, fmt.Errorf("creating http request: %w", err)
	}

	query := url.Values{}
	query.Set("region", params.Region)

	request.URL.RawQuery = query.Encode()
	request.Header.Set("x-request-id", params.RequestID)
	request.Header.Set("Content-Type", "application/json")

	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.cfg.Token))

	response, err := client.httpClient.Do(request)
	if err != nil {
		return authapi.Token{}, fmt.Errorf("sending http request to create access token: %w", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			client.log.Error("closing http response body", "err", err.Error())
		}
	}()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		return authapi.Token{}, fmt.Errorf("unexpected response when creating access token: code=%d body=%s", response.StatusCode, body)
	}

	var token authapi.Token
	if err := json.NewDecoder(response.Body).Decode(&token); err != nil {
		return token, fmt.Errorf("unmarshaling response body: %w", err)
	}

	return token, nil
}

func (client *GcomClient) DeleteToken(ctx context.Context, params authapi.DeleteTokenParams) error {
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

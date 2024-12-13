package gcom

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
)

const LogPrefix = "gcom.service"

var ErrTokenNotFound = errors.New("gcom: token not found")

type Service interface {
	GetInstanceByID(ctx context.Context, requestID string, instanceID string) (Instance, error)
}

type Instance struct {
	ID          int    `json:"id"`
	Slug        string `json:"slug"`
	RegionSlug  string `json:"regionSlug"`
	ClusterSlug string `json:"clusterSlug"`
	OrgId       int    `json:"orgId"`
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

func New(cfg Config, httpClient *http.Client) Service {
	return &GcomClient{
		log:        log.New(LogPrefix),
		cfg:        cfg,
		httpClient: httpClient,
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

package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

const (
	grafanaAlertmanagerConfigPath    = "/api/v1/grafana/config"
	grafanaAlertmanagerReceiversPath = "/api/v1/grafana/receivers"
)

type UserGrafanaConfig struct {
	GrafanaAlertmanagerConfig *apimodels.PostableUserConfig `json:"configuration"`
	Hash                      string                        `json:"configuration_hash"`
	CreatedAt                 int64                         `json:"created"`
	Default                   bool                          `json:"default"`
	Promoted                  bool                          `json:"promoted"`
	ExternalURL               string                        `json:"external_url"`
	SmtpFrom                  string                        `json:"smtp_from"`
	StaticHeaders             map[string]string             `json:"static_headers"`
}

func (mc *Mimir) ShouldPromoteConfig() bool {
	return mc.promoteConfig
}

func (mc *Mimir) GetGrafanaAlertmanagerConfig(ctx context.Context) (*UserGrafanaConfig, error) {
	gc := &UserGrafanaConfig{}
	response := successResponse{
		Data: gc,
	}
	// nolint:bodyclose
	// closed within `do`
	_, err := mc.do(ctx, grafanaAlertmanagerConfigPath, http.MethodGet, nil, &response)
	if err != nil {
		return nil, err
	}

	if response.Status != "success" {
		return nil, fmt.Errorf("returned non-success `status` from the MimirAPI: %s", response.Status)
	}

	return gc, nil
}

func (mc *Mimir) CreateGrafanaAlertmanagerConfig(ctx context.Context, cfg *apimodels.PostableUserConfig, hash string, createdAt int64, isDefault bool) error {
	payload, err := json.Marshal(&UserGrafanaConfig{
		GrafanaAlertmanagerConfig: cfg,
		Hash:                      hash,
		CreatedAt:                 createdAt,
		Default:                   isDefault,
		Promoted:                  mc.promoteConfig,
		ExternalURL:               mc.externalURL,
		SmtpFrom:                  mc.smtpFrom,
		StaticHeaders:             mc.staticHeaders,
	})
	if err != nil {
		return err
	}

	return mc.doOK(ctx, grafanaAlertmanagerConfigPath, http.MethodPost, bytes.NewBuffer(payload))
}

func (mc *Mimir) DeleteGrafanaAlertmanagerConfig(ctx context.Context) error {
	return mc.doOK(ctx, grafanaAlertmanagerConfigPath, http.MethodDelete, nil)
}

func (mc *Mimir) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	response := []apimodels.Receiver{}

	// nolint:bodyclose
	// closed within `do`
	_, err := mc.do(ctx, grafanaAlertmanagerReceiversPath, http.MethodGet, nil, &response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

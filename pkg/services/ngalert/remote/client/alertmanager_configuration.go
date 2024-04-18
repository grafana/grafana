package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

const (
	grafanaAlertmanagerConfigPath = "/api/v1/grafana/config"
)

type UserGrafanaConfig struct {
	GrafanaAlertmanagerConfig string `json:"configuration"`
	Hash                      string `json:"configuration_hash"`
	CreatedAt                 int64  `json:"created"`
	Default                   bool   `json:"default"`
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

func (mc *Mimir) CreateGrafanaAlertmanagerConfig(ctx context.Context, cfg, hash string, createdAt int64, isDefault bool) error {
	payload, err := json.Marshal(&UserGrafanaConfig{
		GrafanaAlertmanagerConfig: cfg,
		Hash:                      hash,
		CreatedAt:                 createdAt,
		Default:                   isDefault,
	})
	if err != nil {
		return err
	}

	return mc.doOK(ctx, grafanaAlertmanagerConfigPath, http.MethodPost, bytes.NewBuffer(payload))
}

func (mc *Mimir) DeleteGrafanaAlertmanagerConfig(ctx context.Context) error {
	return mc.doOK(ctx, grafanaAlertmanagerConfigPath, http.MethodDelete, nil)
}

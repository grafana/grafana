package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

const (
	grafanaAlertmanagerConfigPath = "/grafana/config"
)

type UserGrafanaConfig struct {
	successResponse
	TemplateFiles             map[string]string `json:"template_files"`
	GrafanaAlertmanagerConfig string            `json:"grafana_alertmanager_config"`
}

func (mc *Mimir) GetGrafanaAlertmanagerConfig(ctx context.Context) (*UserGrafanaConfig, error) {
	var config UserGrafanaConfig
	// nolint:bodyclose
	// closed within `do`
	_, err := mc.do(ctx, grafanaAlertmanagerConfigPath, http.MethodGet, nil, -1, &config)
	if err != nil {
		return nil, err
	}

	if config.Status != "success" {
		return nil, fmt.Errorf("returned non-success `status` from the MimirAPI: %s", config.Status)
	}

	return &config, nil
}

func (mc *Mimir) CreateGrafanaAlertmanagerConfig(ctx context.Context, cfg string, templates map[string]string) error {
	payload, err := json.Marshal(&UserGrafanaConfig{
		GrafanaAlertmanagerConfig: cfg,
		TemplateFiles:             templates,
	})
	if err != nil {
		return err
	}

	return mc.doOK(ctx, grafanaAlertmanagerConfigPath, http.MethodPost, bytes.NewBuffer(payload), int64(len(payload)))
}

func (mc *Mimir) DeleteGrafanaAlertmanagerConfig(ctx context.Context) error {
	return mc.doOK(ctx, grafanaAlertmanagerConfigPath, http.MethodDelete, nil, -1)
}

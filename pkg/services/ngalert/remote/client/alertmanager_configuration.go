package client

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
)

const (
	grafanaAlertmanagerConfigPath = "/grafana/config"
)

type UserGrafanaConfig struct {
	TemplateFiles             map[string]string `json:"template_files"`
	GrafanaAlertmanagerConfig string            `json:"grafana_alertmanager_config"`
}

func (mc *Mimir) GetGrafanaAlertmanagerConfig(ctx context.Context) (*UserGrafanaConfig, error) {
	var config UserGrafanaConfig
	err := mc.do(ctx, grafanaAlertmanagerConfigPath, http.MethodGet, nil, -1, &config)
	if err != nil {
		return nil, err
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

	err = mc.do(ctx, grafanaAlertmanagerConfigPath, http.MethodPost, bytes.NewBuffer(payload), int64(len(payload)), nil)
	if err != nil {
		return err
	}

	return nil
}

func (mc *Mimir) DeleteGrafanaAlertmanagerConfig() {

}

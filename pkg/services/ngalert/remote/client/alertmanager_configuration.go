package client

import (
	"bytes"
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/alerting/definition"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

const (
	grafanaAlertmanagerConfigPath    = "/api/v1/grafana/config"
	grafanaAlertmanagerReceiversPath = "/api/v1/grafana/receivers"
)

type GrafanaAlertmanagerConfig struct {
	// TODO this needs to be deleted once Mimir is updated
	TemplateFiles      map[string]string                    `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig definition.PostableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
	Templates          []definition.PostableApiTemplate     `yaml:"templates,omitempty" json:"templates,omitempty"`
}

func (u *GrafanaAlertmanagerConfig) MarshalJSON() ([]byte, error) {
	// This is special marshaling that makes sure that secrets are not masked.
	type cfg GrafanaAlertmanagerConfig
	return definition.MarshalJSONWithSecrets((*cfg)(u))
}

type UserGrafanaConfig struct {
	GrafanaAlertmanagerConfig GrafanaAlertmanagerConfig `json:"configuration"`
	Hash                      string                    `json:"configuration_hash"`
	CreatedAt                 int64                     `json:"created"`
	Default                   bool                      `json:"default"`
	Promoted                  bool                      `json:"promoted"`
	ExternalURL               string                    `json:"external_url"`
	SmtpConfig                SmtpConfig                `json:"smtp_config"`
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

func (mc *Mimir) CreateGrafanaAlertmanagerConfig(ctx context.Context, cfg *UserGrafanaConfig) error {
	payload, err := definition.MarshalJSONWithSecrets(cfg)
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

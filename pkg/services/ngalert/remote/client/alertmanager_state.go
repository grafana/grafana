package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

const (
	grafanaAlertmanagerStatePath = "/api/v1/grafana/state"
)

type UserGrafanaState struct {
	State string `json:"state"`
}

func (mc *Mimir) GetGrafanaAlertmanagerState(ctx context.Context) (*UserGrafanaState, error) {
	gs := &UserGrafanaState{}
	response := successResponse{
		Data: gs,
	}
	// nolint:bodyclose
	// closed within `do`
	_, err := mc.do(ctx, path, http.MethodGet, nil, &response)
	if err != nil {
		return nil, err
	}

	if response.Status != "success" {
		return nil, fmt.Errorf("returned non-success `status` from the MimirAPI: %s", response.Status)
	}

	return gs, nil
}

func (mc *Mimir) CreateGrafanaAlertmanagerState(ctx context.Context, state string) error {
	payload, err := json.Marshal(&UserGrafanaState{
		State: state,
	})
	if err != nil {
		return err
	}

	return mc.doOK(ctx, grafanaAlertmanagerStatePath, http.MethodPost, bytes.NewBuffer(payload))
}

func (mc *Mimir) DeleteGrafanaAlertmanagerState(ctx context.Context) error {
	return mc.doOK(ctx, grafanaAlertmanagerStatePath, http.MethodDelete, nil)
}

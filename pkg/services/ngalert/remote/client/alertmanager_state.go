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
	successResponse
	State string `json:"state"`
}

func (mc *Mimir) GetGrafanaAlertmanagerState(ctx context.Context) (*UserGrafanaState, error) {
	var state UserGrafanaState
	// nolint:bodyclose
	// closed within `do`
	_, err := mc.do(ctx, grafanaAlertmanagerStatePath, http.MethodGet, nil, -1, &state)
	if err != nil {
		return nil, err
	}

	if state.Status != "success" {
		return nil, fmt.Errorf("returned non-success `status` from the MimirAPI: %s", state.Status)
	}

	return &state, nil
}

func (mc *Mimir) CreateGrafanaAlertmanagerState(ctx context.Context, state string) error {
	payload, err := json.Marshal(&UserGrafanaState{
		State: state,
	})
	if err != nil {
		return err
	}

	return mc.doOK(ctx, grafanaAlertmanagerStatePath, http.MethodPost, bytes.NewBuffer(payload), int64(len(payload)))
}

func (mc *Mimir) DeleteGrafanaAlertmanagerState(ctx context.Context) error {
	return mc.doOK(ctx, grafanaAlertmanagerStatePath, http.MethodDelete, nil, -1)
}

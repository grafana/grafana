package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

const (
	fullStatePath                = "/api/v1/grafana/full_state"
	grafanaAlertmanagerStatePath = "/api/v1/grafana/state"
)

// UserState is used for both Grafana state and Mimir full state.
type UserState struct {
	State string `json:"state"`
}

func (mc *Mimir) GetFullState(ctx context.Context) (*UserState, error) {
	return mc.getState(ctx, fullStatePath)
}

func (mc *Mimir) GetGrafanaAlertmanagerState(ctx context.Context) (*UserState, error) {
	return mc.getState(ctx, grafanaAlertmanagerStatePath)
}

func (mc *Mimir) getState(ctx context.Context, path string) (*UserState, error) {
	gs := &UserState{}
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
	payload, err := json.Marshal(&UserState{
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

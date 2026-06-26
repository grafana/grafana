package fakes

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type FakePluginClient struct {
	backend.QueryDataHandlerFunc
	backend.MutateAdmissionFunc
	backend.ValidateAdmissionFunc
}

func (pc *FakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if pc.QueryDataHandlerFunc != nil {
		return pc.QueryDataHandlerFunc(ctx, req)
	}

	return nil, errors.New("QueryDataHandlerFunc not implemented")
}

func (pc *FakePluginClient) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	if pc.ValidateAdmissionFunc != nil {
		return pc.ValidateAdmissionFunc(ctx, req)
	}

	return nil, errors.New("ValidateAdmissionFunc not implemented")
}

func (pc *FakePluginClient) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	if pc.MutateAdmissionFunc != nil {
		return pc.MutateAdmissionFunc(ctx, req)
	}

	return nil, errors.New("MutateAdmissionFunc not implemented")
}

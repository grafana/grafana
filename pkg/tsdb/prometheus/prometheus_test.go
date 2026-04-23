package prometheus

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-prometheus-datasource/pkg/promlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockLib struct {
	queryDataFn         func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
	callResourceFn      func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error
	getBuildInfoFn      func(ctx context.Context, req promlib.BuildInfoRequest) (*promlib.BuildInfoResponse, error)
	getHeuristicsFn     func(ctx context.Context, req promlib.HeuristicsRequest) (*promlib.Heuristics, error)
	checkHealthFn       func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error)
	validateAdmissionFn func(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error)
	mutateAdmissionFn   func(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error)
	convertObjectsFn    func(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error)
}

func (m *mockLib) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return m.queryDataFn(ctx, req)
}
func (m *mockLib) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.callResourceFn(ctx, req, sender)
}
func (m *mockLib) GetBuildInfo(ctx context.Context, req promlib.BuildInfoRequest) (*promlib.BuildInfoResponse, error) {
	return m.getBuildInfoFn(ctx, req)
}
func (m *mockLib) GetHeuristics(ctx context.Context, req promlib.HeuristicsRequest) (*promlib.Heuristics, error) {
	return m.getHeuristicsFn(ctx, req)
}
func (m *mockLib) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.checkHealthFn(ctx, req)
}
func (m *mockLib) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	return m.validateAdmissionFn(ctx, req)
}
func (m *mockLib) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	return m.mutateAdmissionFn(ctx, req)
}
func (m *mockLib) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return m.convertObjectsFn(ctx, req)
}

func TestProvideService(t *testing.T) {
	svc := ProvideService(sdkhttpclient.NewProvider())
	require.NotNil(t, svc)
	require.NotNil(t, svc.lib)
}

func TestQueryData(t *testing.T) {
	want := &backend.QueryDataResponse{}
	svc := &Service{lib: &mockLib{
		queryDataFn: func(_ context.Context, _ *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			return want, nil
		},
	}}
	got, err := svc.QueryData(context.Background(), &backend.QueryDataRequest{})
	require.NoError(t, err)
	assert.Same(t, want, got)
}

func TestQueryData_Error(t *testing.T) {
	wantErr := errors.New("query failed")
	svc := &Service{lib: &mockLib{
		queryDataFn: func(_ context.Context, _ *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			return nil, wantErr
		},
	}}
	_, err := svc.QueryData(context.Background(), &backend.QueryDataRequest{})
	assert.ErrorIs(t, err, wantErr)
}

func TestCallResource(t *testing.T) {
	called := false
	svc := &Service{lib: &mockLib{
		callResourceFn: func(_ context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
			called = true
			return nil
		},
	}}
	err := svc.CallResource(context.Background(), &backend.CallResourceRequest{}, nil)
	require.NoError(t, err)
	assert.True(t, called)
}

func TestCallResource_Error(t *testing.T) {
	wantErr := errors.New("resource failed")
	svc := &Service{lib: &mockLib{
		callResourceFn: func(_ context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
			return wantErr
		},
	}}
	err := svc.CallResource(context.Background(), &backend.CallResourceRequest{}, nil)
	assert.ErrorIs(t, err, wantErr)
}

func TestGetBuildInfo(t *testing.T) {
	want := &promlib.BuildInfoResponse{}
	svc := &Service{lib: &mockLib{
		getBuildInfoFn: func(_ context.Context, _ promlib.BuildInfoRequest) (*promlib.BuildInfoResponse, error) {
			return want, nil
		},
	}}
	got, err := svc.GetBuildInfo(context.Background(), promlib.BuildInfoRequest{})
	require.NoError(t, err)
	assert.Same(t, want, got)
}

func TestGetHeuristics(t *testing.T) {
	want := &promlib.Heuristics{}
	svc := &Service{lib: &mockLib{
		getHeuristicsFn: func(_ context.Context, _ promlib.HeuristicsRequest) (*promlib.Heuristics, error) {
			return want, nil
		},
	}}
	got, err := svc.GetHeuristics(context.Background(), promlib.HeuristicsRequest{})
	require.NoError(t, err)
	assert.Same(t, want, got)
}

func TestCheckHealth(t *testing.T) {
	want := &backend.CheckHealthResult{Status: backend.HealthStatusOk}
	svc := &Service{lib: &mockLib{
		checkHealthFn: func(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			return want, nil
		},
	}}
	got, err := svc.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Same(t, want, got)
}

func TestCheckHealth_Error(t *testing.T) {
	wantErr := errors.New("health check failed")
	svc := &Service{lib: &mockLib{
		checkHealthFn: func(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			return nil, wantErr
		},
	}}
	_, err := svc.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	assert.ErrorIs(t, err, wantErr)
}

func TestValidateAdmission(t *testing.T) {
	want := &backend.ValidationResponse{Allowed: true}
	svc := &Service{lib: &mockLib{
		validateAdmissionFn: func(_ context.Context, _ *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
			return want, nil
		},
	}}
	got, err := svc.ValidateAdmission(context.Background(), &backend.AdmissionRequest{})
	require.NoError(t, err)
	assert.Same(t, want, got)
}

func TestMutateAdmission(t *testing.T) {
	want := &backend.MutationResponse{Allowed: true}
	svc := &Service{lib: &mockLib{
		mutateAdmissionFn: func(_ context.Context, _ *backend.AdmissionRequest) (*backend.MutationResponse, error) {
			return want, nil
		},
	}}
	got, err := svc.MutateAdmission(context.Background(), &backend.AdmissionRequest{})
	require.NoError(t, err)
	assert.Same(t, want, got)
}

func TestConvertObjects(t *testing.T) {
	want := &backend.ConversionResponse{}
	svc := &Service{lib: &mockLib{
		convertObjectsFn: func(_ context.Context, _ *backend.ConversionRequest) (*backend.ConversionResponse, error) {
			return want, nil
		},
	}}
	got, err := svc.ConvertObjects(context.Background(), &backend.ConversionRequest{})
	require.NoError(t, err)
	assert.Same(t, want, got)
}

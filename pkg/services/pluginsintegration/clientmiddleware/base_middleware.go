package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
)

var _ = plugins.Client(&baseMiddleware{})

// The base middleware simply passes the request down the chain
// This allows middleware to avoid implementing all the noop functions
type baseMiddleware struct {
	next plugins.Client
}

func (m *baseMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return m.next.QueryData(ctx, req)
}

func (m *baseMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.next.CallResource(ctx, req, sender)
}

func (m *baseMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.next.CheckHealth(ctx, req)
}

func (m *baseMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *baseMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *baseMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *baseMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}

// ValidateAdmission implements backend.AdmissionHandler.
func (m *baseMiddleware) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	return m.next.ValidateAdmission(ctx, req)
}

// MutateAdmission implements backend.AdmissionHandler.
func (m *baseMiddleware) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	return m.next.MutateAdmission(ctx, req)
}

// ConvertObject implements backend.AdmissionHandler.
func (m *baseMiddleware) ConvertObject(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return m.next.ConvertObject(ctx, req)
}

func (m *baseMiddleware) MigrateQuery(ctx context.Context, req *backend.QueryMigrationRequest) (*backend.QueryMigrationResponse, error) {
	return m.next.MigrateQuery(ctx, req)
}

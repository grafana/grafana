package federated

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	otelcodes "go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestFederatedGetStatsErrors(t *testing.T) {
	result := &resourcepb.ErrorResult{Code: 404, Reason: "NotFound", Message: "folder not found"}
	st, err := status.New(codes.NotFound, result.Message).WithDetails(result)
	require.NoError(t, err)
	for _, encoding := range []string{"embedded", "grpc"} {
		t.Run(encoding, func(t *testing.T) {
			response, err := &resourcepb.ResourceStatsResponse{Error: result}, error(nil)
			if encoding == "grpc" {
				response, err = nil, st.Err()
			}
			base := resource.NewMockResourceClient(t)
			in := &resourcepb.ResourceStatsRequest{Namespace: "default", Folder: []string{"missing"}}
			base.On("GetStats", mock.Anything, in).Return(response, err).Once()
			client := NewFederatedClient(base, func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				t.Fatal("SQL must not be called after a storage error")
				return nil, nil
			}, nil)

			response, err = client.GetStats(context.Background(), in)
			require.Error(t, err)
			require.Nil(t, response)
			require.Equal(t, result.Code, resource.AsErrorResult(err).Code)
			require.Equal(t, result.Message, resource.AsErrorResult(err).Message)
		})
	}
}

func TestFederatedGetStatsWithoutLegacySourceFails(t *testing.T) {
	base := resource.NewMockResourceClient(t)
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
	base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{}, nil).Once()
	client := NewFederatedClient(base, nil, nil)

	_, err := client.GetStats(t.Context(), in)
	var countErr *CountError
	require.ErrorAs(t, err, &countErr)
	require.ErrorIs(t, err, ErrLegacyStatsUnavailable)
	require.Equal(t, LegacyCountedResources, countErr.Resources)
}

func TestFederatedGetStatsDeletedLegacyNamespace(t *testing.T) {
	stats := []*resourcepb.ResourceStatsResponse_Stats{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 2}}
	base := resource.NewMockResourceClient(t)
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
	base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{Stats: stats}, nil).Once()
	client := NewFederatedClient(base, func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, fmt.Errorf("lookup stack: %w", legacysql.ErrNamespaceDeleted)
	}, nil)

	response, err := client.GetStats(t.Context(), in)
	require.NoError(t, err)
	require.Equal(t, stats, response.Stats)
}

func TestFederatedGetStatsLegacyLookupError(t *testing.T) {
	base := resource.NewMockResourceClient(t)
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
	base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{}, nil).Once()
	client := NewFederatedClient(base, func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, fmt.Errorf("lookup stack: %w", context.DeadlineExceeded)
	}, nil)

	_, err := client.GetStats(t.Context(), in)
	require.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestFederatedGetStatsUnavailableLegacyNamespace(t *testing.T) {
	base := resource.NewMockResourceClient(t)
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
	base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{}, nil).Once()
	client := NewFederatedClient(base, func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, fmt.Errorf("lookup stack: %w", legacysql.ErrNamespaceNotFound)
	}, nil)

	_, err := client.GetStats(t.Context(), in)
	require.ErrorIs(t, err, legacysql.ErrNamespaceNotFound)
}

func TestFederatedGetStatsRecordsLegacyErrorOnSpan(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	previous := tracer
	tracer = provider.Tracer("github.com/grafana/grafana/pkg/storage/unified/federated")
	t.Cleanup(func() { tracer = previous })

	base := resource.NewMockResourceClient(t)
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
	base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{}, nil).Once()
	client := NewFederatedClient(base, func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, errors.New("dial tcp 10.0.0.1:3306: connection refused")
	}, nil)

	_, err := client.GetStats(t.Context(), in)
	require.Error(t, err)

	spans := recorder.Ended()
	require.Len(t, spans, 1)
	require.Equal(t, "federated.federatedClient.GetStats", spans[0].Name())
	require.Equal(t, otelcodes.Error, spans[0].Status().Code)
	require.Contains(t, spans[0].Status().Description, "connection refused")
}

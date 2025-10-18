package graphite

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		s.logger.Error("failed to get data source info", "error", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Graphite health check failed. See details below",
			JSONDetails: []byte(
				fmt.Sprintf(`{"verboseMessage": %s }`, strconv.Quote(err.Error())),
			),
		}, nil
	}

	healthCheckQuery := backend.DataQuery{
		Interval: 10 * time.Millisecond,
		RefID:    "graphite-healthcheck",
		TimeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour),
			To:   time.Now(),
		},
		MaxDataPoints: 100,
		JSON:          []byte(`{"target": "constantLine(100)"}`),
	}

	_, span := tracing.DefaultTracer().Start(ctx, "graphite healthcheck")
	defer span.End()
	graphiteReq, formData, _, err := s.createGraphiteRequest(ctx, healthCheckQuery, dsInfo)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Graphite health check failed. See details below",
			JSONDetails: []byte(
				fmt.Sprintf(`{"verboseMessage": %s }`, strconv.Quote(err.Error())),
			),
		}, nil
	}
	targetStr := strings.Join(formData["target"], ",")
	span.SetAttributes(
		attribute.String("target", targetStr),
		attribute.String("from", formData["from"][0]),
		attribute.String("until", formData["until"][0]),
		attribute.Int64("datasource_id", dsInfo.Id),
	)
	res, err := dsInfo.HTTPClient.Do(graphiteReq)
	if res != nil {
		span.SetAttributes(attribute.Int("graphite.response.code", res.StatusCode))
	}
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Graphite health check failed. See details below",
			JSONDetails: []byte(
				fmt.Sprintf(`{"verboseMessage": %s }`, strconv.Quote(err.Error())),
			),
		}, nil
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			s.logger.Warn("Failed to close response body", "error", err)
		}
	}()

	_, err = s.toDataFrames(res, healthCheckQuery.RefID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Graphite health check failed. See details below",
			JSONDetails: []byte(
				fmt.Sprintf(`{"verboseMessage": %s }`, strconv.Quote(err.Error())),
			),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Successfully connected to Graphite",
	}, nil
}

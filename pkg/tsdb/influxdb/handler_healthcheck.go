package influxdb

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/flux"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil || dsInfo == nil {
		return &backend.CheckHealthResult{
			Message: fmt.Sprintf("Error getting datasource info. %s", err.Error()),
			Status:  backend.HealthStatusError,
		}, nil
	}
	switch dsInfo.Version {
	case influxVersionFlux:
		return CheckFluxHealth(ctx, dsInfo, req)
	case influxVersionInfluxQL:
		return CheckInfluxQLHealth(ctx, dsInfo, s)
	default:
		return &backend.CheckHealthResult{
			Message: "unknown influx version",
			Status:  backend.HealthStatusError,
		}, nil
	}
}

func CheckFluxHealth(ctx context.Context, dsInfo *models.DatasourceInfo, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ds, err := flux.Query(ctx, dsInfo, backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Queries: []backend.DataQuery{
			{
				RefID: "healthcheck",
				TimeRange: backend.TimeRange{
					From: time.Now().AddDate(0, 0, -1),
					To:   time.Now(),
				},
				Interval:      1 * time.Minute,
				MaxDataPoints: 423,
				JSON:          []byte(`{ "query" : "buckets()" }`),
			},
		},
	})
	if err != nil {
		return &backend.CheckHealthResult{
			Message: fmt.Sprintf("Error reading InfluxDB. %s", err.Error()),
			Status:  backend.HealthStatusError,
		}, nil
	}
	if res, ok := ds.Responses["healthcheck"]; ok {
		if res.Error != nil {
			return &backend.CheckHealthResult{
				Message: fmt.Sprintf("Error reading buckets. %s", res.Error.Error()),
				Status:  backend.HealthStatusError,
			}, nil
		}
		if len(res.Frames) > 0 && len(res.Frames[0].Fields) > 0 {
			return &backend.CheckHealthResult{
				Message: fmt.Sprintf("Data source is working. %d buckets found", res.Frames[0].Fields[0].Len()),
				Status:  backend.HealthStatusOk,
			}, nil
		}
	}
	return &backend.CheckHealthResult{
		Message: "Error reading buckets",
		Status:  backend.HealthStatusError,
	}, nil
}

func CheckInfluxQLHealth(ctx context.Context, dsInfo *models.DatasourceInfo, s *Service) (*backend.CheckHealthResult, error) {
	influxQLHealthCheckQuery := "SHOW TAG KEYS"
	request, err := s.createRequest(ctx, dsInfo, influxQLHealthCheckQuery)
	if err != nil {
		return &backend.CheckHealthResult{
			Message: fmt.Sprintf("Error reading InfluxDB. %s", err.Error()),
			Status:  backend.HealthStatusError,
		}, nil
	}
	res, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		return &backend.CheckHealthResult{
			Message: fmt.Sprintf("Error reading InfluxDB. %s", err.Error()),
			Status:  backend.HealthStatusError,
		}, nil
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			s.glog.Warn("Failed to close response body", "err", err)
		}
	}()
	if res.StatusCode/100 != 2 {
		return &backend.CheckHealthResult{
			Message: fmt.Sprintf("Error reading InfluxDB. Status Code : %d", res.StatusCode),
			Status:  backend.HealthStatusError,
		}, nil
	}
	resp := s.responseParser.Parse(res.Body, []Query{{
		RefID:       "healthcheck",
		UseRawQuery: true,
		RawQuery:    influxQLHealthCheckQuery,
	}})
	if res, ok := resp.Responses["healthcheck"]; ok {
		if res.Error != nil {
			return &backend.CheckHealthResult{
				Message: fmt.Sprintf("Error reading InfluxDB. %s", res.Error.Error()),
				Status:  backend.HealthStatusError,
			}, nil
		}
		if len(res.Frames) > 0 && len(res.Frames[0].Fields) > 0 {
			return &backend.CheckHealthResult{
				Message: fmt.Sprintf("Data source is working. %d tag keys found", res.Frames[0].Fields[0].Len()),
				Status:  backend.HealthStatusOk,
			}, nil
		}
	}
	return &backend.CheckHealthResult{
		Message: "Error connecting influxDB influxQL",
		Status:  backend.HealthStatusError,
	}, nil
}

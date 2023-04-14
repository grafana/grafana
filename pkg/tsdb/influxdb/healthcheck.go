package influxdb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/flux"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

const (
	refID = "healthcheck"
)

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult,
	error) {
	logger := logger.FromContext(ctx)
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return getHealthCheckMessage(logger, "error getting datasource info", err)
	}

	if dsInfo == nil {
		return getHealthCheckMessage(logger, "", errors.New("invalid datasource info received"))
	}

	switch dsInfo.Version {
	case influxVersionFlux:
		return CheckFluxHealth(ctx, dsInfo, req)
	case influxVersionInfluxQL:
		return CheckInfluxQLHealth(ctx, dsInfo, s)
	default:
		return getHealthCheckMessage(logger, "", errors.New("unknown influx version"))
	}
}

func CheckFluxHealth(ctx context.Context, dsInfo *models.DatasourceInfo,
	req *backend.CheckHealthRequest) (*backend.CheckHealthResult,
	error) {
	logger := logger.FromContext(ctx)
	ds, err := flux.Query(ctx, dsInfo, backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Queries: []backend.DataQuery{
			{
				RefID:         refID,
				JSON:          []byte(`{ "query": "buckets()" }`),
				Interval:      1 * time.Minute,
				MaxDataPoints: 423,
				TimeRange: backend.TimeRange{
					From: time.Now().AddDate(0, 0, -1),
					To:   time.Now(),
				},
			},
		},
	})

	if err != nil {
		return getHealthCheckMessage(logger, "error performing flux query", err)
	}
	if res, ok := ds.Responses[refID]; ok {
		if res.Error != nil {
			return getHealthCheckMessage(logger, "error reading buckets", res.Error)
		}
		if len(res.Frames) > 0 && len(res.Frames[0].Fields) > 0 {
			return getHealthCheckMessage(logger, fmt.Sprintf("%d buckets found", res.Frames[0].Fields[0].Len()), nil)
		}
	}

	return getHealthCheckMessage(logger, "", errors.New("error getting flux query buckets"))
}

func CheckInfluxQLHealth(ctx context.Context, dsInfo *models.DatasourceInfo, s *Service) (*backend.CheckHealthResult, error) {
	logger := logger.FromContext(ctx)
	queryString := "SHOW measurements"
	hcRequest, err := s.createRequest(ctx, logger, dsInfo, queryString)
	if err != nil {
		return getHealthCheckMessage(logger, "error creating influxDB healthcheck request", err)
	}

	res, err := dsInfo.HTTPClient.Do(hcRequest)
	if err != nil {
		return getHealthCheckMessage(logger, "error performing influxQL query", err)
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		return getHealthCheckMessage(logger, "", fmt.Errorf("error reading InfluxDB. Status Code: %d", res.StatusCode))
	}
	resp := s.responseParser.Parse(res.Body, []Query{{
		RefID:       refID,
		UseRawQuery: true,
		RawQuery:    queryString,
	}})
	if res, ok := resp.Responses[refID]; ok {
		if res.Error != nil {
			return getHealthCheckMessage(logger, "error reading influxDB", res.Error)
		}

		if len(res.Frames) == 0 {
			return getHealthCheckMessage(logger, "0 measurements found", nil)
		}

		if len(res.Frames) > 0 && len(res.Frames[0].Fields) > 0 {
			return getHealthCheckMessage(logger, fmt.Sprintf("%d measurements found", res.Frames[0].Fields[0].Len()), nil)
		}
	}

	return getHealthCheckMessage(logger, "", errors.New("error connecting influxDB influxQL"))
}

func getHealthCheckMessage(logger log.Logger, message string, err error) (*backend.CheckHealthResult, error) {
	if err == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: fmt.Sprintf("datasource is working. %s", message),
		}, nil
	}

	logger.Warn("error performing influxdb healthcheck", "err", err.Error())
	errorMessage := fmt.Sprintf("%s %s", err.Error(), message)

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: errorMessage,
	}, nil
}

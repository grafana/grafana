package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

const (
	refID = "__healthcheck__"
)

var logger log.Logger = log.New("tsdb.prometheus")

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult,
	error) {
	logger := logger.FromContext(ctx)
	i, err := s.getInstance(req.PluginContext)

	// check that the datasource exists
	if err != nil {
		return getHealthCheckMessage(logger, "error getting datasource info", err)
	}

	if i == nil {
		return getHealthCheckMessage(logger, "", errors.New("invalid datasource info received"))
	}

	// execute the Prometheus healthy api, e.g. http://localhost:9090/-/healthy
	// https://prometheus.io/docs/prometheus/latest/management_api/
	resp, err := i.resource.Execute(ctx, &backend.CallResourceRequest{
		PluginContext: req.PluginContext,
		Path:          "/-/healthy",
		Method:        http.MethodGet,
	})

	if err != nil {
		return getHealthCheckMessage(logger, "Prometheus healthcheck error.", err)
	}

	// if the prom instance does not have the healthy check
	// fallback to making a simple query to check setup
	if resp != nil {
		if string(resp.Body) == "404 page not found\n" {
			return healthcheckFallback(ctx, req, i)
		}

		return getHealthCheckMessage(logger, string(resp.Body), nil)
	}

	// for everything else
	return getHealthCheckMessage(logger, "", errors.New("unknown prometheus issue"))
}

func getHealthCheckMessage(logger log.Logger, message string, err error) (*backend.CheckHealthResult, error) {
	if err == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: fmt.Sprintf("Prometheus datasource is working. %s", message),
		}, nil
	}

	logger.Warn("error performing prometheus healthcheck", "err", err.Error())
	errorMessage := fmt.Sprintf("%s %s", err.Error(), message)

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: errorMessage,
	}, nil
}

func healthcheckFallback(ctx context.Context, req *backend.CheckHealthRequest, i *instance) (*backend.CheckHealthResult, error) {
	instant := true
	qm := models.QueryModel{
		LegendFormat: "",
		UtcOffsetSec: 0,
		PrometheusDataQuery: dataquery.PrometheusDataQuery{
			Expr:    "1+1",
			Instant: &instant,
		},
	}
	b, _ := json.Marshal(&qm)

	query := backend.DataQuery{
		RefID: refID,
		TimeRange: backend.TimeRange{
			From: time.Unix(1, 0).UTC(),
			To:   time.Unix(4, 0).UTC(),
		},
		JSON: b,
	}
	resp, err := i.queryData.Execute(ctx, &backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Queries:       []backend.DataQuery{query},
	})

	if err != nil {
		return getHealthCheckMessage(logger, "Prometheus datasource error", err)
	}

	// This should be more descriptive but we don't return errors from execute.
	// Adding errors based on __healthcheck__ refId
	if resp.Responses[refID].Error != nil {
		return getHealthCheckMessage(logger, "Prometheus datasource configuration error", errors.New(resp.Responses[refID].Error.Error()))
	}

	return getHealthCheckMessage(logger, "A successful query has been made.", nil)
}

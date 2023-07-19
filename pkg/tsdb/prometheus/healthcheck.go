package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/kindsys"

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
	ds, err := s.getInstance(ctx, req.PluginContext)

	// check that the datasource exists
	if err != nil {
		return getHealthCheckMessage("error getting datasource info", err)
	}

	if ds == nil {
		return getHealthCheckMessage("", errors.New("invalid datasource info received"))
	}

	hc, err := healthcheck(ctx, req, ds)
	if err != nil {
		logger.Warn("error performing prometheus healthcheck", "err", err.Error())
		return nil, err
	}

	heuristics, err := getHeuristics(ctx, ds)
	if err != nil {
		logger.Warn("failed to get prometheus heuristics", "err", err.Error())
	} else {
		jsonDetails, err := json.Marshal(heuristics)
		if err != nil {
			logger.Warn("failed to marshal heuristics", "err", err)
		} else {
			hc.JSONDetails = jsonDetails
		}
	}

	return hc, nil
}

func healthcheck(ctx context.Context, req *backend.CheckHealthRequest, i *instance) (*backend.CheckHealthResult, error) {
	qm := models.QueryModel{
		LegendFormat: "",
		UtcOffsetSec: 0,
		PrometheusDataQuery: dataquery.PrometheusDataQuery{
			Expr:    "1+1",
			Instant: kindsys.Ptr(true),
			RefId:   refID,
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
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.", err)
	}

	if resp.Responses[refID].Error != nil {
		return getHealthCheckMessage("There was an error returned querying the Prometheus API.",
			errors.New(resp.Responses[refID].Error.Error()))
	}

	return getHealthCheckMessage("Successfully queried the Prometheus API.", nil)
}

func getHealthCheckMessage(message string, err error) (*backend.CheckHealthResult, error) {
	if err == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: message,
		}, nil
	}

	errorMessage := fmt.Sprintf("%s - %s", err.Error(), message)

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: errorMessage,
	}, nil
}

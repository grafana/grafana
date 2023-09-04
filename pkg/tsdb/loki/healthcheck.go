package loki

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
)

const (
	refID = "__healthcheck__"
)

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult,
	error) {
	logger := logger.FromContext(ctx)
	ds, err := s.im.Get(ctx, req.PluginContext)
	// check that the datasource exists
	if err != nil {
		return getHealthCheckMessage("error getting datasource info", err)
	}

	if ds == nil {
		return getHealthCheckMessage("", errors.New("invalid datasource info received"))
	}

	hc, err := healthcheck(ctx, req, s)
	if err != nil {
		logger.Warn("error performing loki healthcheck", "err", err.Error())
		return nil, err
	}

	return hc, nil
}

func healthcheck(ctx context.Context, req *backend.CheckHealthRequest, s *Service) (*backend.CheckHealthResult, error) {
	step := "1s"
	qt := "instant"
	qm := dataquery.LokiDataQuery{
		Expr:      "vector(1)+vector(1)",
		Step:      &step,
		QueryType: &qt,
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
	resp, err := s.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Queries:       []backend.DataQuery{query},
	})

	if err != nil {
		return getHealthCheckMessage("There was an error returned querying the Loki API.", err)
	}

	if resp.Responses[refID].Error != nil {
		return getHealthCheckMessage("There was an error returned querying the Loki API.",
			errors.New(resp.Responses[refID].Error.Error()))
	}

	if len(resp.Responses[refID].Frames) == 0 {
		return getHealthCheckMessage("There was an error returned querying the Loki API.", errors.New("no frames"))
	}

	if len(resp.Responses[refID].Frames[0].Fields) != 2 {
		return getHealthCheckMessage("There was an error returned querying the Loki API.", errors.New("invalid response"))
	}

	if resp.Responses[refID].Frames[0].Fields[0].Len() != 1 {
		return getHealthCheckMessage("There was an error returned querying the Loki API.", errors.New("invalid response"))
	}

	rspValue := resp.Responses[refID].Frames[0].Fields[1].At(0).(float64)
	if rspValue != 2 {
		return getHealthCheckMessage("There was an error returned querying the Loki API.", errors.New("invalid response"))
	}

	return getHealthCheckMessage("Data source successfully connected.", nil)
}

func getHealthCheckMessage(message string, err error) (*backend.CheckHealthResult, error) {
	if err == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: message,
		}, nil
	}

	errorMessage := fmt.Sprintf("%s: %s", message, err.Error())

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: errorMessage,
	}, nil
}

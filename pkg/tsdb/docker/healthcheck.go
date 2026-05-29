package docker

import (
    "context"
    "fmt"

    "github.com/grafana/grafana-plugin-sdk-go/backend"
    "github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

const (
	refID = "docker-healthcheck"
)

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
    logger := s.logger.With("endpoint", "checkHealth")
    ds, err := s.getDSInfo(ctx, req.PluginContext)
    
    // check if datasource exists
    if err != nil {
        return getHealthCheckMessage(fmt.Errorf("failed to get data source information: %w", err), logger), nil
    }

    if ds == nil {
        return getHealthCheckMessage(fmt.Errorf("invalid datasource info received"), logger), nil
    }

    hc := healthcheck(ctx, req, s, logger)

    return hc, nil
}


func healthcheck(ctx context.Context, req *backend.CheckHealthRequest,  s *Service, logger log.Logger) *backend.CheckHealthResult {
    // build simple query

    healthCheckQuery := backend.DataQuery{
        RefID:    refID,
        JSON: []byte(`{"resourceType":"system_df"}`),
    } // TODO build query


    resp, err := s.QueryData(ctx, &backend.QueryDataRequest{
        PluginContext: req.PluginContext,
        Queries:       []backend.DataQuery{healthCheckQuery},
	})

    if err != nil {
        return getHealthCheckMessage(fmt.Errorf("error received while querying loki: %w", err), logger)
    }

    frameLen := len(resp.Responses[refID].Frames)
    if frameLen != 1 {
        return getHealthCheckMessage(fmt.Errorf("invalid dataframe length, expected %d got %d", 1, frameLen), logger)
    }


    // TODO implement rest of data integrity checks

    return getHealthCheckMessage(nil, logger);
}


func getHealthCheckMessage(err error, logger log.Logger) *backend.CheckHealthResult {
	if err == nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: "Data source successfully connected.",
		}
	}

	logger.Error("Docker health check failed", "error", err)
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: "Docker health check failed.",
	}
}

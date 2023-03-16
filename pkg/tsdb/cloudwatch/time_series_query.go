package cloudwatch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"golang.org/x/sync/errgroup"
)

type responseWrapper struct {
	DataResponse *backend.DataResponse
	RefId        string
}

func (e *cloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	plog.Debug("Executing time series query")
	resp := backend.NewQueryDataResponse()

	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("request contains no queries")
	}
	// startTime and endTime are always the same for all queries
	startTime := req.Queries[0].TimeRange.From
	endTime := req.Queries[0].TimeRange.To
	if !startTime.Before(endTime) {
		return nil, fmt.Errorf("invalid time range: start time must be before end time")
	}

	dsInfo, err := e.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	requestQueriesByRegion, err := e.parseQueries(req.Queries, startTime, endTime, dsInfo.region)
	if err != nil {
		return nil, err
	}

	if len(requestQueriesByRegion) == 0 {
		return backend.NewQueryDataResponse(), nil
	}

	resultChan := make(chan *responseWrapper, len(req.Queries))
	eg, ectx := errgroup.WithContext(ctx)
	for r, q := range requestQueriesByRegion {
		requestQueries := q
		region := r
		eg.Go(func() error {
			defer func() {
				if err := recover(); err != nil {
					plog.Error("Execute Get Metric Data Query Panic", "error", err, "stack", log.Stack(1))
					if theErr, ok := err.(error); ok {
						resultChan <- &responseWrapper{
							DataResponse: &backend.DataResponse{
								Error: theErr,
							},
						}
					}
				}
			}()

			client, err := e.getCWClient(req.PluginContext, region)
			if err != nil {
				return err
			}

			metricDataInput, err := e.buildMetricDataInput(startTime, endTime, requestQueries)
			if err != nil {
				return err
			}

			mdo, err := e.executeRequest(ectx, client, metricDataInput)
			if err != nil {
				return err
			}

			res, err := e.parseResponse(startTime, endTime, mdo, requestQueries)
			if err != nil {
				return err
			}

			for _, responseWrapper := range res {
				resultChan <- responseWrapper
			}

			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		dataResponse := backend.DataResponse{
			Error: fmt.Errorf("metric request error: %q", err),
		}
		resultChan <- &responseWrapper{
			DataResponse: &dataResponse,
		}
	}
	close(resultChan)

	for result := range resultChan {
		resp.Responses[result.RefId] = *result.DataResponse
	}

	return resp, nil
}

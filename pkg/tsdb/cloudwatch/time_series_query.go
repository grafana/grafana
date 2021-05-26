package cloudwatch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"golang.org/x/sync/errgroup"
)

func (e *cloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	plog.Debug("Executing time series query")

	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		startTime := q.TimeRange.From
		endTime := q.TimeRange.To
		if !startTime.Before(endTime) {
			return nil, fmt.Errorf("invalid time range: start time must be before end time")
		}

		requestQueriesByRegion, err := e.parseQueries(req, startTime, endTime)
		if err != nil {
			return nil, err
		}

		if len(requestQueriesByRegion) == 0 {
			return backend.NewQueryDataResponse(), nil
		}

		resultChan := make(chan *backend.DataResponse, len(req.Queries))
		eg, ectx := errgroup.WithContext(ctx)
		for r, q := range requestQueriesByRegion {
			requestQueries := q
			region := r
			eg.Go(func() error {
				defer func() {
					if err := recover(); err != nil {
						plog.Error("Execute Get Metric Data Query Panic", "error", err, "stack", log.Stack(1))
						if theErr, ok := err.(error); ok {
							resultChan <- &backend.DataResponse{
								Error: theErr,
							}
						}
					}
				}()

				client, err := e.getCWClient(region, req.PluginContext)
				if err != nil {
					return err
				}

				queries, err := e.transformRequestQueriesToCloudWatchQueries(requestQueries)
				if err != nil {
					for _, query := range requestQueries {
						resultChan <- &backend.DataResponse{
							Frames: data.Frames{data.NewFrame(query.RefId)},
							Error:  err,
						}
					}
					return nil
				}

				metricDataInput, err := e.buildMetricDataInput(startTime, endTime, queries)
				if err != nil {
					return err
				}

				cloudwatchResponses := make([]*cloudwatchResponse, 0)
				mdo, err := e.executeRequest(ectx, client, metricDataInput)
				if err != nil {
					for _, query := range requestQueries {
						resultChan <- &backend.DataResponse{
							Frames: data.Frames{data.NewFrame(query.RefId)},
							Error:  err,
						}
					}
					return nil
				}

				responses, err := e.parseResponse(mdo, queries)
				if err != nil {
					for _, query := range requestQueries {
						resultChan <- &backend.DataResponse{
							Frames: data.Frames{data.NewFrame(query.RefId)},
							Error:  err,
						}
					}
					return nil
				}

				cloudwatchResponses = append(cloudwatchResponses, responses...)
				res, err := e.transformQueryResponsesToQueryResult(cloudwatchResponses, requestQueries, startTime, endTime)
				if err != nil {
					for _, query := range requestQueries {
						resultChan <- &backend.DataResponse{
							Frames: data.Frames{data.NewFrame(query.RefId)},
							Error:  err,
						}
					}
					return nil
				}

				for _, queryRes := range res {
					resultChan <- queryRes
				}
				return nil
			})
		}

		if err := eg.Wait(); err != nil {
			return nil, err
		}
		close(resultChan)

		for result := range resultChan {
			resp.Responses[q.RefID] = *result
		}
	}

	return resp, nil
}

package cloudwatch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	pluginmodels "github.com/grafana/grafana/pkg/plugins/models"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/sync/errgroup"
)

func (e *cloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, queryContext pluginmodels.DataQuery) (
	pluginmodels.DataResponse, error) {
	plog.Debug("Executing time series query")
	startTime, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		return pluginmodels.DataResponse{}, errutil.Wrap("failed to parse start time", err)
	}
	endTime, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		return pluginmodels.DataResponse{}, errutil.Wrap("failed to parse end time", err)
	}
	if !startTime.Before(endTime) {
		return pluginmodels.DataResponse{}, fmt.Errorf("invalid time range: start time must be before end time")
	}

	requestQueriesByRegion, err := e.parseQueries(queryContext, startTime, endTime)
	if err != nil {
		return pluginmodels.DataResponse{}, err
	}

	if len(requestQueriesByRegion) == 0 {
		return pluginmodels.DataResponse{
			Results: make(map[string]pluginmodels.DataQueryResult),
		}, nil
	}

	resultChan := make(chan pluginmodels.DataQueryResult, len(queryContext.Queries))
	eg, ectx := errgroup.WithContext(ctx)
	for r, q := range requestQueriesByRegion {
		requestQueries := q
		region := r
		eg.Go(func() error {
			defer func() {
				if err := recover(); err != nil {
					plog.Error("Execute Get Metric Data Query Panic", "error", err, "stack", log.Stack(1))
					if theErr, ok := err.(error); ok {
						resultChan <- pluginmodels.DataQueryResult{
							Error: theErr,
						}
					}
				}
			}()

			client, err := e.getCWClient(region)
			if err != nil {
				return err
			}

			queries, err := e.transformRequestQueriesToCloudWatchQueries(requestQueries)
			if err != nil {
				for _, query := range requestQueries {
					resultChan <- pluginmodels.DataQueryResult{
						RefID: query.RefId,
						Error: err,
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
					resultChan <- pluginmodels.DataQueryResult{
						RefID: query.RefId,
						Error: err,
					}
				}
				return nil
			}

			responses, err := e.parseResponse(mdo, queries)
			if err != nil {
				for _, query := range requestQueries {
					resultChan <- pluginmodels.DataQueryResult{
						RefID: query.RefId,
						Error: err,
					}
				}
				return nil
			}

			cloudwatchResponses = append(cloudwatchResponses, responses...)
			res, err := e.transformQueryResponsesToQueryResult(cloudwatchResponses, requestQueries, startTime, endTime)
			if err != nil {
				for _, query := range requestQueries {
					resultChan <- pluginmodels.DataQueryResult{
						RefID: query.RefId,
						Error: err,
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
		return pluginmodels.DataResponse{}, err
	}
	close(resultChan)

	results := pluginmodels.DataResponse{
		Results: make(map[string]pluginmodels.DataQueryResult),
	}
	for result := range resultChan {
		results.Results[result.RefID] = result
	}
	return results, nil
}

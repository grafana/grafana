package cloudwatch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/sync/errgroup"
)

func (e *CloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	results := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	startTime, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	if !startTime.Before(endTime) {
		return nil, fmt.Errorf("Invalid time range: Start time must be before end time")
	}

	requestQueriesByRegion, err := e.parseQueries(queryContext, startTime, endTime)
	if err != nil {
		return results, err
	}
	resultChan := make(chan *tsdb.QueryResult, len(queryContext.Queries))
	eg, ectx := errgroup.WithContext(ctx)

	if len(requestQueriesByRegion) > 0 {
		for r, q := range requestQueriesByRegion {
			requestQueries := q
			region := r
			eg.Go(func() error {
				defer func() {
					if err := recover(); err != nil {
						plog.Error("Execute Get Metric Data Query Panic", "error", err, "stack", log.Stack(1))
						if theErr, ok := err.(error); ok {
							resultChan <- &tsdb.QueryResult{
								Error: theErr,
							}
						}
					}
				}()

				client, err := e.getClient(region)
				if err != nil {
					return err
				}

				queries, err := e.transformRequestQueriesToCloudWatchQueries(requestQueries)
				if err != nil {
					for _, query := range requestQueries {
						resultChan <- &tsdb.QueryResult{
							RefId: query.RefId,
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
						resultChan <- &tsdb.QueryResult{
							RefId: query.RefId,
							Error: err,
						}
					}
					return nil
				}

				responses, err := e.parseResponse(mdo, queries)
				if err != nil {
					for _, query := range requestQueries {
						resultChan <- &tsdb.QueryResult{
							RefId: query.RefId,
							Error: err,
						}
					}
					return nil
				}
				cloudwatchResponses = append(cloudwatchResponses, responses...)
				res := e.transformQueryResponseToQueryResult(cloudwatchResponses)
				for _, queryRes := range res {
					resultChan <- queryRes
				}
				return nil
			})
		}
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}
	close(resultChan)
	for result := range resultChan {
		results.Results[result.RefId] = result
	}

	return results, nil
}

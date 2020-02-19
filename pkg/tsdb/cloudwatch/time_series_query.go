package cloudwatch

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/sync/errgroup"
	simpleLog "log"
)

func (e *CloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {

	simpleLog.Println("executeTimeSeriesQuery")
	results := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	// simpleLog.Println("made response")
	startTime, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		simpleLog.Println("error parsing from")
		return nil, err
	}

	endTime, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		simpleLog.Println("error parsing to")
		return nil, err
	}

	if !startTime.Before(endTime) {
		return nil, fmt.Errorf("Invalid time range: Start time must be before end time")
	}

	// simpleLog.Println("passed time error")

	requestQueriesByRegion, err := e.parseQueries(queryContext, startTime, endTime)
	if err != nil {
		simpleLog.Println("error in requestQueriesByRegion")
		return results, err
	}
	// simpleLog.Println("passed requestQueriesByRegion")
	resultChan := make(chan *tsdb.QueryResult, len(queryContext.Queries))
	eg, ectx := errgroup.WithContext(ctx)

	// simpleLog.Println("about to iterate requestQueriesByRegion")

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

				// simpleLog.Println("about to get client")

				client, err := e.getClient(region)
				if err != nil {
					// simpleLog.Println("errored in get client")
					return err
				}

				// plog.Info("About to log the queries")
				// plog.Info(prettyPrint(requestQueries))

				// simpleLog.Println("")
				// simpleLog.Println("About to log the queries")
				// simpleLog.Println(prettyPrint(requestQueries))

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

				// plog.Info("About to log the queries")
				// plog.Info(prettyPrint(requestQueries))

				// simpleLog.Println("About to log the queries")
				// simpleLog.Println(prettyPrint(requestQueries))

				// plog.Info("Cloudwatch API request")
				// plog.Info(prettyPrint(queries))

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
				// plog.Info("Cloudwatch API response")
				// plog.Info(prettyPrint(mdo))

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

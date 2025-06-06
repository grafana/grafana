package cloudwatch

import (
	"context"
	"fmt"
	"regexp"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

type responseWrapper struct {
	DataResponse *backend.DataResponse
	RefId        string
}

func (e *cloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	e.logger.FromContext(ctx).Debug("Executing time series query")
	resp := backend.NewQueryDataResponse()

	if len(req.Queries) == 0 {
		return nil, backend.DownstreamError(fmt.Errorf("request contains no queries"))
	}

	instance, err := e.getInstance(ctx, req.PluginContext)
	if err != nil {
		resp.Responses[req.Queries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
		return resp, nil
	}

	timeBatches := utils.BatchDataQueriesByTimeRange(req.Queries)
	requestQueriesByTimeAndRegion := make(map[string][]*models.CloudWatchQuery)
	for i, timeBatch := range timeBatches {
		startTime := timeBatch[0].TimeRange.From
		endTime := timeBatch[0].TimeRange.To
		if !startTime.Before(endTime) {
			return nil, backend.DownstreamError(fmt.Errorf("invalid time range: start time must be before end time"))
		}
		requestQueries, err := models.ParseMetricDataQueries(timeBatch, startTime, endTime, instance.Settings.Region, e.logger.FromContext(ctx),
			features.IsEnabled(ctx, features.FlagCloudWatchCrossAccountQuerying))
		if err != nil {
			return nil, err
		}

		for _, query := range requestQueries {
			key := fmt.Sprintf("%d %s", i, query.Region)
			if _, exist := requestQueriesByTimeAndRegion[key]; !exist {
				requestQueriesByTimeAndRegion[key] = []*models.CloudWatchQuery{}
			}
			requestQueriesByTimeAndRegion[key] = append(requestQueriesByTimeAndRegion[key], query)
		}
	}
	if len(requestQueriesByTimeAndRegion) == 0 {
		return backend.NewQueryDataResponse(), nil
	}

	resultChan := make(chan *responseWrapper, len(req.Queries))
	eg, ectx := errgroup.WithContext(ctx)
	for _, timeAndRegionQueries := range requestQueriesByTimeAndRegion {
		batches := [][]*models.CloudWatchQuery{timeAndRegionQueries}
		if features.IsEnabled(ctx, features.FlagCloudWatchBatchQueries) {
			batches = getMetricQueryBatches(timeAndRegionQueries, e.logger.FromContext(ctx))
		}

		// region, startTime, and endTime are the same for the set of queries
		region := timeAndRegionQueries[0].Region
		startTime := timeAndRegionQueries[0].StartTime
		endTime := timeAndRegionQueries[0].EndTime

		for _, batch := range batches {
			requestQueries := batch
			eg.Go(func() error {
				defer func() {
					if err := recover(); err != nil {
						e.logger.FromContext(ctx).Error("Execute Get Metric Data Query Panic", "error", err, "stack", utils.Stack(1))
						if theErr, ok := err.(error); ok {
							resultChan <- &responseWrapper{
								DataResponse: &backend.DataResponse{
									Error: theErr,
								},
							}
						}
					}
				}()

				client, err := e.getCWClient(ctx, req.PluginContext, region)
				if err != nil {
					return err
				}

				metricDataInput, err := e.buildMetricDataInput(ctx, startTime, endTime, requestQueries)
				if err != nil {
					return err
				}

				mdo, err := e.executeRequest(ectx, client, metricDataInput)
				if err != nil {
					return err
				}

				requestQueries, err = e.getDimensionValuesForWildcards(ctx, region, client, requestQueries, instance.tagValueCache, instance.Settings.GrafanaSettings.ListMetricsPageLimit, shouldSkipFetchingWildcards)
				if err != nil {
					return err
				}

				res, err := e.parseResponse(ctx, mdo, requestQueries)
				if err != nil {
					return err
				}

				for _, responseWrapper := range res {
					resultChan <- responseWrapper
				}

				return nil
			})
		}
	}

	if err := eg.Wait(); err != nil {
		dataResponse := backend.ErrorResponseWithErrorSource(fmt.Errorf("metric request error: %w", err))
		resultChan <- &responseWrapper{
			RefId:        getQueryRefIdFromErrorString(err.Error(), requestQueriesByTimeAndRegion),
			DataResponse: &dataResponse,
		}
	}
	close(resultChan)

	for result := range resultChan {
		resp.Responses[result.RefId] = *result.DataResponse
	}

	return resp, nil
}

func getQueryRefIdFromErrorString(err string, queriesByRegion map[string][]*models.CloudWatchQuery) string {
	// error can be in format "Error in expression 'test': Invalid syntax"
	// so we can find the query id or ref id between the quotations
	erroredRefId := ""

	for _, queries := range queriesByRegion {
		for _, query := range queries {
			if regexp.MustCompile(`'`+query.RefId+`':`).MatchString(err) || regexp.MustCompile(`'`+query.Id+`':`).MatchString(err) {
				erroredRefId = query.RefId
			}
		}
	}
	// if errorRefId is empty, it means the error concerns all queries (error metric limit exceeded, for example)
	return erroredRefId
}

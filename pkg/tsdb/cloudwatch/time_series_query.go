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
		return nil, fmt.Errorf("request contains no queries")
	}
	// startTime and endTime are always the same for all queries
	startTime := req.Queries[0].TimeRange.From
	endTime := req.Queries[0].TimeRange.To
	if !startTime.Before(endTime) {
		return nil, fmt.Errorf("invalid time range: start time must be before end time")
	}

	instance, err := e.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	requestQueries, err := models.ParseMetricDataQueries(req.Queries, startTime, endTime, instance.Settings.Region, e.logger.FromContext(ctx),
		features.IsEnabled(ctx, features.FlagCloudWatchCrossAccountQuerying))
	if err != nil {
		return nil, err
	}

	if len(requestQueries) == 0 {
		return backend.NewQueryDataResponse(), nil
	}

	requestQueriesByRegion := make(map[string][]*models.CloudWatchQuery)
	for _, query := range requestQueries {
		if _, exist := requestQueriesByRegion[query.Region]; !exist {
			requestQueriesByRegion[query.Region] = []*models.CloudWatchQuery{}
		}
		requestQueriesByRegion[query.Region] = append(requestQueriesByRegion[query.Region], query)
	}

	resultChan := make(chan *responseWrapper, len(req.Queries))
	eg, ectx := errgroup.WithContext(ctx)
	for r, regionQueries := range requestQueriesByRegion {
		region := r

		batches := [][]*models.CloudWatchQuery{regionQueries}
		if features.IsEnabled(ctx, features.FlagCloudWatchBatchQueries) {
			batches = getMetricQueryBatches(regionQueries, e.logger.FromContext(ctx))
		}

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

				metricDataInput, err := e.buildMetricDataInput(startTime, endTime, requestQueries)
				if err != nil {
					return err
				}

				mdo, err := e.executeRequest(ectx, client, metricDataInput)
				if err != nil {
					return err
				}

				if features.IsEnabled(ctx, features.FlagCloudWatchWildCardDimensionValues) {
					requestQueries, err = e.getDimensionValuesForWildcards(ctx, req.PluginContext, region, client, requestQueries, instance.tagValueCache, instance.Settings.GrafanaSettings.ListMetricsPageLimit)
					if err != nil {
						return err
					}
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
	}

	if err := eg.Wait(); err != nil {
		dataResponse := backend.DataResponse{
			Error: fmt.Errorf("metric request error: %q", err),
		}
		resultChan <- &responseWrapper{
			RefId:        getQueryRefIdFromErrorString(err.Error(), requestQueries),
			DataResponse: &dataResponse,
		}
	}
	close(resultChan)

	for result := range resultChan {
		resp.Responses[result.RefId] = *result.DataResponse
	}

	return resp, nil
}

func getQueryRefIdFromErrorString(err string, queries []*models.CloudWatchQuery) string {
	// error can be in format "Error in expression 'test': Invalid syntax"
	// so we can find the query id or ref id between the quotations
	erroredRefId := ""

	for _, query := range queries {
		if regexp.MustCompile(`'`+query.RefId+`':`).MatchString(err) || regexp.MustCompile(`'`+query.Id+`':`).MatchString(err) {
			erroredRefId = query.RefId
		}
	}
	// if errorRefId is empty, it means the error concerns all queries (error metric limit exceeded, for example)
	return erroredRefId
}

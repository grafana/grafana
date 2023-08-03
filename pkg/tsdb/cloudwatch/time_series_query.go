package cloudwatch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

type responseWrapper struct {
	DataResponse *backend.DataResponse
	RefId        string
}

func (e *cloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, logger log.Logger, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger.Debug("Executing time series query")
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

	requestQueries, err := models.ParseMetricDataQueries(req.Queries, startTime, endTime, instance.Settings.Region, logger,
		e.features.IsEnabled(featuremgmt.FlagCloudWatchCrossAccountQuerying))
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
	for r, q := range requestQueriesByRegion {
		requestQueries := q
		region := r
		eg.Go(func() error {
			defer func() {
				if err := recover(); err != nil {
					logger.Error("Execute Get Metric Data Query Panic", "error", err, "stack", log.Stack(1))
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

			metricDataInput, err := e.buildMetricDataInput(logger, startTime, endTime, requestQueries)
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

package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	alertMaxAttempts = 8
	alertPollPeriod  = time.Second
)

func (e *cloudWatchExecutor) executeLogAlertQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		var model LogQueryJson
		err := json.Unmarshal(q.JSON, &model)
		if err != nil {
			continue
		}

		model.Subtype = "StartQuery"
		model.QueryString = model.Expression

		region := model.Region
		if model.Region == "" || region == defaultRegion {
			instance, err := e.getInstance(req.PluginContext)
			if err != nil {
				return nil, err
			}
			model.Region = instance.Settings.Region
		}

		logsClient, err := e.getCWLogsClient(req.PluginContext, region)
		if err != nil {
			return nil, err
		}

		getQueryResultsOutput, err := e.alertQuery(ctx, logsClient, q, model)
		if err != nil {
			return nil, err
		}

		dataframe, err := logsResultsToDataframes(getQueryResultsOutput)
		if err != nil {
			return nil, err
		}

		var frames []*data.Frame
		if len(model.StatsGroups) > 0 && len(dataframe.Fields) > 0 {
			frames, err = groupResults(dataframe, model.StatsGroups)
			if err != nil {
				return nil, err
			}
		} else {
			frames = data.Frames{dataframe}
		}

		respD := resp.Responses["A"]
		respD.Frames = frames
		resp.Responses["A"] = respD
	}

	return resp, nil
}

func (e *cloudWatchExecutor) alertQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	queryContext backend.DataQuery, model LogQueryJson) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, model, queryContext.TimeRange)
	if err != nil {
		return nil, err
	}

	requestParams := LogQueryJson{
		Region:  model.Region,
		QueryId: *startQueryOutput.QueryId,
	}

	ticker := time.NewTicker(alertPollPeriod)
	defer ticker.Stop()

	attemptCount := 1
	for range ticker.C {
		res, err := e.executeGetQueryResults(ctx, logsClient, requestParams)
		if err != nil {
			return nil, err
		}
		if isTerminated(*res.Status) {
			return res, err
		}
		if attemptCount >= alertMaxAttempts {
			return res, fmt.Errorf("fetching of query results exceeded max number of attempts")
		}

		attemptCount++
	}

	return nil, nil
}

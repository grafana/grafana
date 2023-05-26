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
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

const (
	alertMaxAttempts = 8
	alertPollPeriod  = time.Second
)

var executeSyncLogQuery = func(ctx context.Context, e *cloudWatchExecutor, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		var logsQuery models.LogsQuery
		err := json.Unmarshal(q.JSON, &logsQuery)
		if err != nil {
			continue
		}

		logsQuery.Subtype = "StartQuery"
		if logsQuery.Expression != nil {
			logsQuery.QueryString = *logsQuery.Expression
		}

		region := logsQuery.Region
		if logsQuery.Region == "" || region == defaultRegion {
			instance, err := e.getInstance(ctx, req.PluginContext)
			if err != nil {
				return nil, err
			}
			logsQuery.Region = instance.Settings.Region
		}

		logsClient, err := e.getCWLogsClient(ctx, req.PluginContext, region)
		if err != nil {
			return nil, err
		}

		getQueryResultsOutput, err := e.syncQuery(ctx, logsClient, q, logsQuery)
		if err != nil {
			return nil, err
		}

		dataframe, err := logsResultsToDataframes(getQueryResultsOutput)
		if err != nil {
			return nil, err
		}

		var frames []*data.Frame
		if len(logsQuery.StatsGroups) > 0 && len(dataframe.Fields) > 0 {
			frames, err = groupResults(dataframe, logsQuery.StatsGroups, true)
			if err != nil {
				return nil, err
			}
		} else {
			frames = data.Frames{dataframe}
		}

		refId := "A"
		if q.RefID != "" {
			refId = q.RefID
		}

		respD := resp.Responses[refId]
		respD.Frames = frames
		resp.Responses[refId] = respD
	}

	return resp, nil
}

func (e *cloudWatchExecutor) syncQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	queryContext backend.DataQuery, logsQuery models.LogsQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, logsQuery, queryContext.TimeRange)
	if err != nil {
		return nil, err
	}

	requestParams := models.LogsQuery{
		CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
			Region: logsQuery.Region,
		},
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

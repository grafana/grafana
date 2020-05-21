package cloudwatch

import (
	"context"
	"fmt"
	"sort"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/sync/errgroup"
)

func (e *CloudWatchExecutor) executeLogActions(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	resultChan := make(chan *tsdb.QueryResult, len(queryContext.Queries))
	eg, ectx := errgroup.WithContext(ctx)

	for _, query := range queryContext.Queries {
		query := query

		eg.Go(func() error {
			dataframe, err := e.executeLogAction(ectx, queryContext, query)
			if err != nil {
				return err
			}

			// When a query of the form "stats ... by ..." is made, we want to return
			// one series per group defined in the query, but due to the format
			// the query response is in, there does not seem to be a way to tell
			// by the response alone if/how the results should be grouped.
			// Because of this, if the frontend sees that a "stats ... by ..." query is being made
			// the "statsGroups" parameter is sent along with the query to the backend so that we
			// can correctly group the CloudWatch logs response.
			statsGroups := query.Model.Get("statsGroups").MustStringArray()
			if len(statsGroups) > 0 && len(dataframe.Fields) > 0 {
				groupedFrames, err := groupResults(dataframe, statsGroups)
				if err != nil {
					return err
				}

				encodedFrames := make([][]byte, 0)
				for _, frame := range groupedFrames {
					dataframeEnc, err := frame.MarshalArrow()
					if err != nil {
						return err
					}
					encodedFrames = append(encodedFrames, dataframeEnc)
				}

				resultChan <- &tsdb.QueryResult{RefId: query.RefId, Dataframes: encodedFrames}
				return nil
			}

			dataframeEnc, err := dataframe.MarshalArrow()
			if err != nil {
				return err
			}

			resultChan <- &tsdb.QueryResult{RefId: query.RefId, Dataframes: [][]byte{dataframeEnc}}
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	close(resultChan)

	response := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	for result := range resultChan {
		response.Results[result.RefId] = result
	}

	return response, nil
}

func (e *CloudWatchExecutor) executeLogAction(ctx context.Context, queryContext *tsdb.TsdbQuery, query *tsdb.Query) (*data.Frame, error) {
	parameters := query.Model
	subType := query.Model.Get("subtype").MustString()

	defaultRegion := e.DataSource.JsonData.Get("defaultRegion").MustString()
	region := parameters.Get("region").MustString(defaultRegion)
	logsClient, err := e.getLogsClient(region)
	if err != nil {
		return nil, err
	}

	var data *data.Frame = nil

	switch subType {
	case "DescribeLogGroups":
		data, err = e.handleDescribeLogGroups(ctx, logsClient, parameters)
	case "GetLogGroupFields":
		data, err = e.handleGetLogGroupFields(ctx, logsClient, parameters, query.RefId)
	case "StartQuery":
		data, err = e.handleStartQuery(ctx, logsClient, parameters, queryContext.TimeRange, query.RefId)
	case "StopQuery":
		data, err = e.handleStopQuery(ctx, logsClient, parameters)
	case "GetQueryResults":
		data, err = e.handleGetQueryResults(ctx, logsClient, parameters, query.RefId)
	case "GetLogEvents":
		data, err = e.handleGetLogEvents(ctx, logsClient, parameters)
	}

	if err != nil {
		return nil, err
	}

	return data, nil
}

func (e *CloudWatchExecutor) handleGetLogEvents(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json) (*data.Frame, error) {
	queryRequest := &cloudwatchlogs.GetLogEventsInput{
		Limit:         aws.Int64(parameters.Get("limit").MustInt64(10)),
		StartFromHead: aws.Bool(parameters.Get("startFromHead").MustBool(false)),
	}

	logGroupName, err := parameters.Get("logGroupName").String()
	if err != nil {
		return nil, fmt.Errorf("Error: Parameter 'logGroupName' is required")
	}
	queryRequest.SetLogGroupName(logGroupName)

	logStreamName, err := parameters.Get("logStreamName").String()
	if err != nil {
		return nil, fmt.Errorf("Error: Parameter 'logStream' is required")
	}
	queryRequest.SetLogStreamName(logStreamName)

	if startTime, err := parameters.Get("startTime").Int64(); err == nil {
		queryRequest.SetStartTime(startTime)
	}

	if endTime, err := parameters.Get("endTime").Int64(); err == nil {
		queryRequest.SetEndTime(endTime)
	}

	logEvents, err := logsClient.GetLogEventsWithContext(ctx, queryRequest)
	if err != nil {
		return nil, err
	}

	messages := make([]*string, 0)
	timestamps := make([]*int64, 0)

	sort.Slice(logEvents.Events, func(i, j int) bool {
		return *(logEvents.Events[i].Timestamp) > *(logEvents.Events[j].Timestamp)
	})

	for _, event := range logEvents.Events {
		messages = append(messages, event.Message)
		timestamps = append(timestamps, event.Timestamp)
	}

	timestampField := data.NewField("ts", nil, timestamps)
	timestampField.SetConfig(&data.FieldConfig{Title: "Time"})

	messageField := data.NewField("line", nil, messages)

	return data.NewFrame("logEvents", timestampField, messageField), nil
}

func (e *CloudWatchExecutor) handleDescribeLogGroups(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json) (*data.Frame, error) {
	logGroupNamePrefix := parameters.Get("logGroupNamePrefix").MustString("")
	var response *cloudwatchlogs.DescribeLogGroupsOutput = nil
	var err error

	if len(logGroupNamePrefix) < 1 {
		response, err = logsClient.DescribeLogGroupsWithContext(ctx, &cloudwatchlogs.DescribeLogGroupsInput{
			Limit: aws.Int64(parameters.Get("limit").MustInt64(50)),
		})
	} else {
		response, err = logsClient.DescribeLogGroupsWithContext(ctx, &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int64(parameters.Get("limit").MustInt64(50)),
			LogGroupNamePrefix: aws.String(logGroupNamePrefix),
		})
	}

	if err != nil || response == nil {
		return nil, err
	}

	logGroupNames := make([]*string, 0)
	for _, logGroup := range response.LogGroups {
		logGroupNames = append(logGroupNames, logGroup.LogGroupName)
	}

	groupNamesField := data.NewField("logGroupName", nil, logGroupNames)
	frame := data.NewFrame("logGroups", groupNamesField)

	return frame, nil
}

func (e *CloudWatchExecutor) executeStartQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json, timeRange *tsdb.TimeRange) (*cloudwatchlogs.StartQueryOutput, error) {
	startTime, err := timeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := timeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	if !startTime.Before(endTime) {
		return nil, fmt.Errorf("invalid time range: Start time must be before end time")
	}

	// The fields @log and @logStream are always included in the results of a user's query
	// so that a row's context can be retrieved later if necessary.
	// The usage of ltrim around the @log/@logStream fields is a necessary workaround, as without it,
	// CloudWatch wouldn't consider a query using a non-alised @log/@logStream valid.
	startQueryInput := &cloudwatchlogs.StartQueryInput{
		StartTime:     aws.Int64(startTime.Unix()),
		EndTime:       aws.Int64(endTime.Unix()),
		Limit:         aws.Int64(parameters.Get("limit").MustInt64(1000)),
		LogGroupNames: aws.StringSlice(parameters.Get("logGroupNames").MustStringArray()),
		QueryString:   aws.String("fields @timestamp,ltrim(@log) as " + LOG_IDENTIFIER_INTERNAL + ",ltrim(@logStream) as " + LOGSTREAM_IDENTIFIER_INTERNAL + "|" + parameters.Get("queryString").MustString("")),
	}
	return logsClient.StartQueryWithContext(ctx, startQueryInput)
}

func (e *CloudWatchExecutor) handleStartQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json, timeRange *tsdb.TimeRange, refID string) (*data.Frame, error) {
	startQueryResponse, err := e.executeStartQuery(ctx, logsClient, parameters, timeRange)
	if err != nil {
		return nil, err
	}

	dataFrame := data.NewFrame(refID, data.NewField("queryId", nil, []string{*startQueryResponse.QueryId}))
	dataFrame.RefID = refID

	clientRegion := parameters.Get("region").MustString("default")

	dataFrame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"Region": clientRegion,
		},
	}

	return dataFrame, nil
}

func (e *CloudWatchExecutor) executeStopQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json) (*cloudwatchlogs.StopQueryOutput, error) {
	queryInput := &cloudwatchlogs.StopQueryInput{
		QueryId: aws.String(parameters.Get("queryId").MustString()),
	}

	response, err := logsClient.StopQueryWithContext(ctx, queryInput)
	if err != nil {
		awsErr, ok := err.(awserr.Error)
		// If the query has already stopped by the time CloudWatch receives the stop query request,
		// an "InvalidParameterException" error is returned. For our purposes though the query has been
		// stopped, so we ignore the error.
		if ok && awsErr.Code() == "InvalidParameterException" {
			response = &cloudwatchlogs.StopQueryOutput{Success: aws.Bool(false)}
			err = nil
		}
	}

	return response, err
}

func (e *CloudWatchExecutor) handleStopQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json) (*data.Frame, error) {
	response, err := e.executeStopQuery(ctx, logsClient, parameters)
	if err != nil {
		return nil, err
	}

	dataFrame := data.NewFrame("StopQueryResponse", data.NewField("success", nil, []bool{*response.Success}))
	return dataFrame, nil
}

func (e *CloudWatchExecutor) executeGetQueryResults(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	queryInput := &cloudwatchlogs.GetQueryResultsInput{
		QueryId: aws.String(parameters.Get("queryId").MustString()),
	}

	return logsClient.GetQueryResultsWithContext(ctx, queryInput)
}

func (e *CloudWatchExecutor) handleGetQueryResults(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json, refID string) (*data.Frame, error) {
	getQueryResultsOutput, err := e.executeGetQueryResults(ctx, logsClient, parameters)
	if err != nil {
		return nil, err
	}

	dataFrame, err := logsResultsToDataframes(getQueryResultsOutput)

	if err != nil {
		return nil, err
	}

	dataFrame.Name = refID
	dataFrame.RefID = refID

	return dataFrame, nil
}

func (e *CloudWatchExecutor) handleGetLogGroupFields(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI, parameters *simplejson.Json, refID string) (*data.Frame, error) {
	queryInput := &cloudwatchlogs.GetLogGroupFieldsInput{
		LogGroupName: aws.String(parameters.Get("logGroupName").MustString()),
		Time:         aws.Int64(parameters.Get("time").MustInt64()),
	}

	getLogGroupFieldsOutput, err := logsClient.GetLogGroupFieldsWithContext(ctx, queryInput)
	if err != nil {
		return nil, err
	}

	fieldNames := make([]*string, 0)
	fieldPercentages := make([]*int64, 0)

	for _, logGroupField := range getLogGroupFieldsOutput.LogGroupFields {
		fieldNames = append(fieldNames, logGroupField.Name)
		fieldPercentages = append(fieldPercentages, logGroupField.Percent)
	}

	dataFrame := data.NewFrame(
		refID,
		data.NewField("name", nil, fieldNames),
		data.NewField("percent", nil, fieldPercentages),
	)

	dataFrame.RefID = refID

	return dataFrame, nil
}

package cloudwatch

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *CloudWatchExecutor) executeLogActions(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	response := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	// logger := log.New("CloudWatch")
	// logger.Info("Executing log actions...")

	for _, query := range queryContext.Queries {
		data, err := e.executeLogAction(ctx, queryContext, query)
		if data == nil {
			return nil, err
		}

		dataframeEnc, err := dataframe.MarshalArrow(data)

		response.Results[query.RefId] = &tsdb.QueryResult{RefId: query.RefId, Dataframes: [][]byte{dataframeEnc}}
	}

	return response, nil
}

func (e *CloudWatchExecutor) executeLogAction(ctx context.Context, queryContext *tsdb.TsdbQuery, query *tsdb.Query) (*dataframe.Frame, error) {
	parameters := query.Model
	subType := query.Model.Get("subtype").MustString()

	// logger := log.New("CloudWatch")
	// logger.Info("Executing Log Action: " + subType)

	var data *dataframe.Frame
	var err error
	switch subType {
	case "DescribeLogGroups":
		data, err = e.handleDescribeLogGroups(ctx, parameters)
	case "GetLogGroupFields":
		data, err = e.handleGetLogGroupFields(ctx, parameters, query)
	case "StartQuery":
		data, err = e.handleStartQuery(ctx, parameters, queryContext, query)
	case "StopQuery":
		data, err = e.handleStopQuery(ctx, parameters, queryContext, query)
	case "GetQueryResults":
		data, err = e.handleGetQueryResults(ctx, parameters, query)
	}

	if data == nil {
		return nil, err
	}

	// log.Info("Log action response: ")
	// dataJSON, _ := json.Marshal(data)
	// log.Info(string(dataJSON))
	return data, nil
}

func (e *CloudWatchExecutor) handleDescribeLogGroups(ctx context.Context, parameters *simplejson.Json) (*dataframe.Frame, error) {
	client, err := e.getLogsClient(parameters.Get("region").MustString())
	if err != nil {
		return nil, err
	}

	logGroupNamePrefix := parameters.Get("logGroupNamePrefix").MustString("")
	var response *cloudwatchlogs.DescribeLogGroupsOutput = nil

	if len(logGroupNamePrefix) < 1 {
		response, err = client.DescribeLogGroups(&cloudwatchlogs.DescribeLogGroupsInput{
			Limit: aws.Int64(parameters.Get("limit").MustInt64(50)),
		})
	} else {
		response, err = client.DescribeLogGroups(&cloudwatchlogs.DescribeLogGroupsInput{
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

	groupNamesField := dataframe.NewField("logGroupName", nil, logGroupNames)
	frame := dataframe.New("logGroups", groupNamesField)

	return frame, nil
}

func (e *CloudWatchExecutor) handleStartQuery(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery, query *tsdb.Query) (*dataframe.Frame, error) {
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

	requestQueries := make(map[string][]*logsQuery)
	region, _ := query.Model.Get("region").String()
	// logger := log.New("CloudWatch")
	// log.Info("Region: " + region)

	if _, exist := requestQueries[region]; !exist {
		requestQueries[region] = make([]*logsQuery, 0)
	}

	startQueryInput := &cloudwatchlogs.StartQueryInput{
		StartTime:     aws.Int64(startTime.Unix()),
		EndTime:       aws.Int64(endTime.Unix()),
		Limit:         aws.Int64(query.Model.Get("limit").MustInt64(1000)),
		LogGroupNames: aws.StringSlice(query.Model.Get("logGroupNames").MustStringArray()),
		QueryString:   aws.String("fields @timestamp |" + query.Model.Get("queryString").MustString("")),
	}

	// queryJSON, _ := json.Marshal(startQueryInput)
	// logger.Info(string(queryJSON))

	client, err := e.getLogsClient(region)
	if err != nil {
		return nil, err
	}

	startQueryResponse, err := client.StartQuery(startQueryInput)
	if err != nil {
		return nil, err
	}

	dataFrame := dataframe.New("queryID", dataframe.NewField("queryId", nil, []string{*startQueryResponse.QueryId}))
	dataFrame.Name = query.RefId
	dataFrame.RefID = query.RefId

	return dataFrame, nil
}

func (e *CloudWatchExecutor) handleStopQuery(ctx context.Context, parameters *simplejson.Json, queryContext *tsdb.TsdbQuery, query *tsdb.Query) (*dataframe.Frame, error) {
	region, _ := query.Model.Get("region").String()

	queryInput := &cloudwatchlogs.StopQueryInput{
		QueryId: aws.String(query.Model.Get("queryId").MustString()),
	}

	// logger := log.New("CloudWatchLogs")
	// queryInputJSON, _ := json.Marshal(queryInput)
	// logger.Info(string(queryInputJSON))

	client, err := e.getLogsClient(region)
	if err != nil {
		return nil, err
	}

	response, err := client.StopQuery(queryInput)
	if err != nil {
		awsErr, _ := err.(awserr.Error)
		if awsErr.Code() == "InvalidParameterException" {
			response = &cloudwatchlogs.StopQueryOutput{Success: aws.Bool(false)}
			err = nil
		} else {
			return nil, err
		}
	}

	// responseJSON, _ := json.Marshal(response)
	// logger.Info(string(responseJSON))

	dataFrame := dataframe.New("StopQueryResponse", dataframe.NewField("success", nil, []bool{*response.Success}))
	return dataFrame, nil
}

func (e *CloudWatchExecutor) handleGetQueryResults(ctx context.Context, parameters *simplejson.Json, query *tsdb.Query) (*dataframe.Frame, error) {
	region, _ := query.Model.Get("region").String()

	queryInput := &cloudwatchlogs.GetQueryResultsInput{
		QueryId: aws.String(query.Model.Get("queryId").MustString()),
	}

	// logger := log.New("CloudWatchLogs")
	// queryInputJSON, _ := json.Marshal(queryInput)
	// logger.Info(string(queryInputJSON))

	client, err := e.getLogsClient(region)
	if err != nil {
		return nil, err
	}

	getQueryResultsOutput, err := client.GetQueryResults(queryInput)
	if err != nil {
		return nil, err
	}

	//outputJSON, _ := json.Marshal(getQueryResultsOutput)
	//logger := log.New("CloudWatch")
	//logger.Info(string(outputJSON))

	dataFrame, err := logsResultsToDataframes(getQueryResultsOutput)
	dataFrame.Name = query.RefId
	dataFrame.RefID = query.RefId

	if err != nil {
		return nil, err
	}

	return dataFrame, nil
}

func (e *CloudWatchExecutor) handleGetLogGroupFields(ctx context.Context, parameters *simplejson.Json, query *tsdb.Query) (*dataframe.Frame, error) {
	region, _ := query.Model.Get("region").String()

	queryInput := &cloudwatchlogs.GetLogGroupFieldsInput{
		LogGroupName: aws.String(query.Model.Get("logGroupName").MustString()),
		Time:         aws.Int64(query.Model.Get("time").MustInt64()),
	}

	client, err := e.getLogsClient(region)
	if err != nil {
		return nil, err
	}

	getLogGroupFieldsOutput, err := client.GetLogGroupFields(queryInput)
	if err != nil {
		return nil, err
	}

	// logger := log.New("CloudWatch")
	// getLogGroupFieldsOutputJSON, _ := json.Marshal(getLogGroupFieldsOutput)
	// logger.Info(string(getLogGroupFieldsOutputJSON))

	fieldNames := make([]*string, 0)
	fieldPercentages := make([]*int64, 0)

	for _, logGroupField := range getLogGroupFieldsOutput.LogGroupFields {
		fieldNames = append(fieldNames, logGroupField.Name)
		fieldPercentages = append(fieldPercentages, logGroupField.Percent)
	}

	dataFrame := dataframe.New(
		"GetLogGroupFieldsOutput",
		dataframe.NewField("name", nil, fieldNames),
		dataframe.NewField("percent", nil, fieldPercentages),
	)
	dataFrame.Name = query.RefId
	dataFrame.RefID = query.RefId

	return dataFrame, nil
}

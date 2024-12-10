package cloudwatch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

const (
	limitExceededException      = "LimitExceededException"
	throttlingException         = "ThrottlingException"
	defaultEventLimit           = int64(10)
	defaultLogGroupLimit        = int64(50)
	logIdentifierInternal       = "__log__grafana_internal__"
	logStreamIdentifierInternal = "__logstream__grafana_internal__"
)

type AWSError struct {
	Code    string
	Message string
	Payload map[string]string
}

func (e *AWSError) Error() string {
	return fmt.Sprintf("CloudWatch error: %s: %s", e.Code, e.Message)
}

// StartQueryInputWithLanguage copies the StartQueryInput struct from aws-sdk-go@v1.55.5
// (https://github.com/aws/aws-sdk-go/blob/7112c0a0c2d01713a9db2d57f0e5722225baf5b5/service/cloudwatchlogs/api.go#L19541)
// to add support for the new QueryLanguage parameter, which is unlikely to be backported
// since v1 of the aws-sdk-go is in maintenance mode. We've removed the comments for
// clarity.
type StartQueryInputWithLanguage struct {
	_ struct{} `type:"structure"`

	EndTime             *int64    `locationName:"endTime" type:"long" required:"true"`
	Limit               *int64    `locationName:"limit" min:"1" type:"integer"`
	LogGroupIdentifiers []*string `locationName:"logGroupIdentifiers" type:"list"`
	LogGroupName        *string   `locationName:"logGroupName" min:"1" type:"string"`
	LogGroupNames       []*string `locationName:"logGroupNames" type:"list"`
	QueryString         *string   `locationName:"queryString" type:"string" required:"true"`
	// QueryLanguage is the only change here from the original code.
	QueryLanguage *string `locationName:"queryLanguage" type:"string"`
	StartTime     *int64  `locationName:"startTime" type:"long" required:"true"`
}
type WithQueryLanguageFunc func(language *dataquery.LogsQueryLanguage) func(*request.Request)

// WithQueryLanguage assigns the function to a variable in order to mock it in log_actions_test.go
var WithQueryLanguage WithQueryLanguageFunc = withQueryLanguage

func withQueryLanguage(language *dataquery.LogsQueryLanguage) func(request *request.Request) {
	return func(request *request.Request) {
		sqi := request.Params.(*cloudwatchlogs.StartQueryInput)
		request.Params = &StartQueryInputWithLanguage{
			EndTime:             sqi.EndTime,
			Limit:               sqi.Limit,
			LogGroupIdentifiers: sqi.LogGroupIdentifiers,
			LogGroupName:        sqi.LogGroupName,
			LogGroupNames:       sqi.LogGroupNames,
			QueryString:         sqi.QueryString,
			QueryLanguage:       (*string)(language),
			StartTime:           sqi.StartTime,
		}
	}
}

func (e *cloudWatchExecutor) executeLogActions(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	resultChan := make(chan backend.Responses, len(req.Queries))
	eg, ectx := errgroup.WithContext(ctx)

	for _, query := range req.Queries {
		var logsQuery models.LogsQuery
		err := json.Unmarshal(query.JSON, &logsQuery)
		if err != nil {
			return nil, err
		}

		query := query
		eg.Go(func() error {
			dataframe, err := e.executeLogAction(ectx, logsQuery, query, req.PluginContext)
			if err != nil {
				resultChan <- backend.Responses{
					query.RefID: errorsource.Response(err),
				}
				return nil
			}

			groupedFrames, err := groupResponseFrame(dataframe, logsQuery.StatsGroups)
			if err != nil {
				return err
			}
			resultChan <- backend.Responses{
				query.RefID: backend.DataResponse{Frames: groupedFrames},
			}
			return nil
		})
	}
	if err := eg.Wait(); err != nil {
		return nil, err
	}

	close(resultChan)

	for result := range resultChan {
		for refID, response := range result {
			respD := resp.Responses[refID]
			respD.Frames = response.Frames
			respD.Error = response.Error
			respD.ErrorSource = response.ErrorSource
			resp.Responses[refID] = respD
		}
	}

	return resp, nil
}

func (e *cloudWatchExecutor) executeLogAction(ctx context.Context, logsQuery models.LogsQuery, query backend.DataQuery, pluginCtx backend.PluginContext) (*data.Frame, error) {
	instance, err := e.getInstance(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	region := instance.Settings.Region
	if logsQuery.Region != nil {
		region = *logsQuery.Region
	}

	logsClient, err := e.getCWLogsClient(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}

	var data *data.Frame = nil
	switch logsQuery.Subtype {
	case "StartQuery":
		data, err = e.handleStartQuery(ctx, logsClient, logsQuery, query.TimeRange, query.RefID)
	case "StopQuery":
		data, err = e.handleStopQuery(ctx, logsClient, logsQuery)
	case "GetQueryResults":
		data, err = e.handleGetQueryResults(ctx, logsClient, logsQuery, query.RefID)
	case "GetLogEvents":
		data, err = e.handleGetLogEvents(ctx, logsClient, logsQuery)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to execute log action with subtype: %s: %w", logsQuery.Subtype, err)
	}

	return data, nil
}

func (e *cloudWatchExecutor) handleGetLogEvents(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery) (*data.Frame, error) {
	limit := defaultEventLimit
	if logsQuery.Limit != nil && *logsQuery.Limit > 0 {
		limit = *logsQuery.Limit
	}

	queryRequest := &cloudwatchlogs.GetLogEventsInput{
		Limit:         aws.Int64(limit),
		StartFromHead: aws.Bool(logsQuery.StartFromHead),
	}

	if logsQuery.LogGroupName == "" {
		return nil, errorsource.DownstreamError(fmt.Errorf("Error: Parameter 'logGroupName' is required"), false)
	}
	queryRequest.SetLogGroupName(logsQuery.LogGroupName)

	if logsQuery.LogStreamName == "" {
		return nil, errorsource.DownstreamError(fmt.Errorf("Error: Parameter 'logStreamName' is required"), false)
	}
	queryRequest.SetLogStreamName(logsQuery.LogStreamName)

	if logsQuery.StartTime != nil && *logsQuery.StartTime != 0 {
		queryRequest.SetStartTime(*logsQuery.StartTime)
	}

	if logsQuery.EndTime != nil && *logsQuery.EndTime != 0 {
		queryRequest.SetEndTime(*logsQuery.EndTime)
	}

	logEvents, err := logsClient.GetLogEventsWithContext(ctx, queryRequest)
	if err != nil {
		return nil, errorsource.DownstreamError(err, false)
	}

	messages := make([]*string, 0)
	timestamps := make([]time.Time, 0)

	sort.Slice(logEvents.Events, func(i, j int) bool {
		return *(logEvents.Events[i].Timestamp) > *(logEvents.Events[j].Timestamp)
	})

	for _, event := range logEvents.Events {
		messages = append(messages, event.Message)
		timestamps = append(timestamps, time.UnixMilli(*event.Timestamp).UTC())
	}

	timestampField := data.NewField("ts", nil, timestamps)
	timestampField.SetConfig(&data.FieldConfig{DisplayName: "Time"})

	messageField := data.NewField("line", nil, messages)

	return data.NewFrame("logEvents", timestampField, messageField), nil
}

func (e *cloudWatchExecutor) executeStartQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery, timeRange backend.TimeRange) (*cloudwatchlogs.StartQueryOutput, error) {
	startTime := timeRange.From
	endTime := timeRange.To

	if !startTime.Before(endTime) {
		return nil, errorsource.DownstreamError(fmt.Errorf("invalid time range: start time must be before end time"), false)
	}
	if logsQuery.QueryLanguage == nil {
		cwli := dataquery.LogsQueryLanguageCWLI
		logsQuery.QueryLanguage = &cwli
	}

	finalQueryString := logsQuery.QueryString
	// Only for CWLI queries
	// The fields @log and @logStream are always included in the results of a user's query
	// so that a row's context can be retrieved later if necessary.
	// The usage of ltrim around the @log/@logStream fields is a necessary workaround, as without it,
	// CloudWatch wouldn't consider a query using a non-alised @log/@logStream valid.
	if *logsQuery.QueryLanguage == dataquery.LogsQueryLanguageCWLI {
		finalQueryString = "fields @timestamp,ltrim(@log) as " + logIdentifierInternal + ",ltrim(@logStream) as " +
			logStreamIdentifierInternal + "|" + logsQuery.QueryString
	}

	startQueryInput := &cloudwatchlogs.StartQueryInput{
		StartTime: aws.Int64(startTime.Unix()),
		// Usually grafana time range allows only second precision, but you can create ranges with milliseconds
		// for example when going from trace to logs for that trace and trace length is sub second. In that case
		// StartTime is effectively floored while here EndTime is ceiled and so we should get the logs user wants
		// and also a little bit more but as CW logs accept only seconds as integers there is not much to do about
		// that.
		EndTime:     aws.Int64(int64(math.Ceil(float64(endTime.UnixNano()) / 1e9))),
		QueryString: aws.String(finalQueryString),
	}

	// log group identifiers can be left out if the query is an SQL query
	if *logsQuery.QueryLanguage != dataquery.LogsQueryLanguageSQL {
		if len(logsQuery.LogGroups) > 0 && features.IsEnabled(ctx, features.FlagCloudWatchCrossAccountQuerying) {
			var logGroupIdentifiers []string
			for _, lg := range logsQuery.LogGroups {
				arn := lg.Arn
				// due to a bug in the startQuery api, we remove * from the arn, otherwise it throws an error
				logGroupIdentifiers = append(logGroupIdentifiers, strings.TrimSuffix(arn, "*"))
			}
			startQueryInput.LogGroupIdentifiers = aws.StringSlice(logGroupIdentifiers)
		} else {
			// even though log group names are being phased out, we still need to support them for backwards compatibility and alert queries
			startQueryInput.LogGroupNames = aws.StringSlice(logsQuery.LogGroupNames)
		}
	}

	if logsQuery.Limit != nil {
		startQueryInput.Limit = aws.Int64(*logsQuery.Limit)
	}

	e.logger.FromContext(ctx).Debug("Calling startquery with context with input", "input", startQueryInput)
	resp, err := logsClient.StartQueryWithContext(ctx, startQueryInput, WithQueryLanguage(logsQuery.QueryLanguage))
	if err != nil {
		var awsErr awserr.Error
		if errors.As(err, &awsErr) && awsErr.Code() == "LimitExceededException" {
			e.logger.FromContext(ctx).Debug("ExecuteStartQuery limit exceeded", "err", awsErr)
			err = &AWSError{Code: limitExceededException, Message: err.Error()}
		} else if errors.As(err, &awsErr) && awsErr.Code() == "ThrottlingException" {
			e.logger.FromContext(ctx).Debug("ExecuteStartQuery rate exceeded", "err", awsErr)
			err = &AWSError{Code: throttlingException, Message: err.Error()}
		}
		err = errorsource.DownstreamError(err, false)
	}
	return resp, err
}

func (e *cloudWatchExecutor) handleStartQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery, timeRange backend.TimeRange, refID string) (*data.Frame, error) {
	startQueryResponse, err := e.executeStartQuery(ctx, logsClient, logsQuery, timeRange)
	if err != nil {
		return nil, err
	}

	dataFrame := data.NewFrame(refID, data.NewField("queryId", nil, []string{*startQueryResponse.QueryId}))
	dataFrame.RefID = refID

	region := "default"
	if logsQuery.Region != nil {
		region = *logsQuery.Region
	}

	dataFrame.Meta = &data.FrameMeta{
		Custom: map[string]any{
			"Region": region,
		},
	}

	return dataFrame, nil
}

func (e *cloudWatchExecutor) executeStopQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery) (*cloudwatchlogs.StopQueryOutput, error) {
	queryInput := &cloudwatchlogs.StopQueryInput{
		QueryId: aws.String(logsQuery.QueryId),
	}

	response, err := logsClient.StopQueryWithContext(ctx, queryInput)
	if err != nil {
		// If the query has already stopped by the time CloudWatch receives the stop query request,
		// an "InvalidParameterException" error is returned. For our purposes though the query has been
		// stopped, so we ignore the error.
		var awsErr awserr.Error
		if errors.As(err, &awsErr) && awsErr.Code() == "InvalidParameterException" {
			response = &cloudwatchlogs.StopQueryOutput{Success: aws.Bool(false)}
			err = nil
		} else {
			err = errorsource.DownstreamError(err, false)
		}
	}

	return response, err
}

func (e *cloudWatchExecutor) handleStopQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery) (*data.Frame, error) {
	response, err := e.executeStopQuery(ctx, logsClient, logsQuery)
	if err != nil {
		return nil, err
	}

	dataFrame := data.NewFrame("StopQueryResponse", data.NewField("success", nil, []bool{*response.Success}))
	return dataFrame, nil
}

func (e *cloudWatchExecutor) executeGetQueryResults(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	queryInput := &cloudwatchlogs.GetQueryResultsInput{
		QueryId: aws.String(logsQuery.QueryId),
	}

	getQueryResultsResponse, err := logsClient.GetQueryResultsWithContext(ctx, queryInput)
	if err != nil {
		var awsErr awserr.Error
		if errors.As(err, &awsErr) {
			err = &AWSError{Code: awsErr.Code(), Message: err.Error()}
		}
		err = errorsource.DownstreamError(err, false)
	}
	return getQueryResultsResponse, err
}

func (e *cloudWatchExecutor) handleGetQueryResults(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery, refID string) (*data.Frame, error) {
	getQueryResultsOutput, err := e.executeGetQueryResults(ctx, logsClient, logsQuery)
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

func groupResponseFrame(frame *data.Frame, statsGroups []string) (data.Frames, error) {
	var dataFrames data.Frames

	// When a query of the form "stats ... by ..." is made, we want to return
	// one series per group defined in the query, but due to the format
	// the query response is in, there does not seem to be a way to tell
	// by the response alone if/how the results should be grouped.
	// Because of this, if the frontend sees that a "stats ... by ..." query is being made
	// the "statsGroups" parameter is sent along with the query to the backend so that we
	// can correctly group the CloudWatch logs response.
	// Check if we have time field though as it makes sense to split only for time series.
	if hasTimeField(frame) {
		if len(statsGroups) > 0 && len(frame.Fields) > 0 {
			groupedFrames, err := groupResults(frame, statsGroups, false)
			if err != nil {
				return nil, err
			}

			dataFrames = groupedFrames
		} else {
			setPreferredVisType(frame, "logs")
			dataFrames = data.Frames{frame}
		}
	} else {
		dataFrames = data.Frames{frame}
	}
	return dataFrames, nil
}

func setPreferredVisType(frame *data.Frame, visType data.VisType) {
	if frame.Meta != nil {
		frame.Meta.PreferredVisualization = visType
	} else {
		frame.Meta = &data.FrameMeta{
			PreferredVisualization: visType,
		}
	}
}

func hasTimeField(frame *data.Frame) bool {
	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeNullableTime {
			return true
		}
	}
	return false
}

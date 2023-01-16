package cloudwatch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

const (
	limitExceededException      = "LimitExceededException"
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
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *cloudWatchExecutor) executeLogActions(ctx context.Context, logger log.Logger, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
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
			dataframe, err := e.executeLogAction(ectx, logger, logsQuery, query, req.PluginContext)
			if err != nil {
				var AWSError *AWSError
				if errors.As(err, &AWSError) {
					resultChan <- backend.Responses{
						query.RefID: backend.DataResponse{Frames: data.Frames{}, Error: AWSError},
					}
					return nil
				}
				return err
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
			resp.Responses[refID] = respD
		}
	}

	return resp, nil
}

func (e *cloudWatchExecutor) executeLogAction(ctx context.Context, logger log.Logger, logsQuery models.LogsQuery, query backend.DataQuery, pluginCtx backend.PluginContext) (*data.Frame, error) {
	instance, err := e.getInstance(pluginCtx)
	if err != nil {
		return nil, err
	}

	region := instance.Settings.Region
	if logsQuery.Region != "" {
		region = logsQuery.Region
	}

	logsClient, err := e.getCWLogsClient(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	var data *data.Frame = nil
	switch logsQuery.SubType {
	case "StartQuery":
		data, err = e.handleStartQuery(ctx, logger, logsClient, logsQuery, query.TimeRange, query.RefID)
	case "StopQuery":
		data, err = e.handleStopQuery(ctx, logsClient, logsQuery)
	case "GetQueryResults":
		data, err = e.handleGetQueryResults(ctx, logsClient, logsQuery, query.RefID)
	case "GetLogEvents":
		data, err = e.handleGetLogEvents(ctx, logsClient, logsQuery)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to execute log action with subtype: %s: %w", logsQuery.SubType, err)
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
		return nil, fmt.Errorf("Error: Parameter 'logGroupName' is required")
	}
	queryRequest.SetLogGroupName(logsQuery.LogGroupName)

	if logsQuery.LogStreamName == "" {
		return nil, fmt.Errorf("Error: Parameter 'logStreamName' is required")
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
	timestampField.SetConfig(&data.FieldConfig{DisplayName: "Time"})

	messageField := data.NewField("line", nil, messages)

	return data.NewFrame("logEvents", timestampField, messageField), nil
}

func (e *cloudWatchExecutor) executeStartQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery, timeRange backend.TimeRange) (*cloudwatchlogs.StartQueryOutput, error) {
	startTime := timeRange.From
	endTime := timeRange.To

	if !startTime.Before(endTime) {
		return nil, fmt.Errorf("invalid time range: start time must be before end time")
	}

	// The fields @log and @logStream are always included in the results of a user's query
	// so that a row's context can be retrieved later if necessary.
	// The usage of ltrim around the @log/@logStream fields is a necessary workaround, as without it,
	// CloudWatch wouldn't consider a query using a non-alised @log/@logStream valid.
	modifiedQueryString := "fields @timestamp,ltrim(@log) as " + logIdentifierInternal + ",ltrim(@logStream) as " +
		logStreamIdentifierInternal + "|" + logsQuery.QueryString

	startQueryInput := &cloudwatchlogs.StartQueryInput{
		StartTime: aws.Int64(startTime.Unix()),
		// Usually grafana time range allows only second precision, but you can create ranges with milliseconds
		// for example when going from trace to logs for that trace and trace length is sub second. In that case
		// StartTime is effectively floored while here EndTime is ceiled and so we should get the logs user wants
		// and also a little bit more but as CW logs accept only seconds as integers there is not much to do about
		// that.
		EndTime:     aws.Int64(int64(math.Ceil(float64(endTime.UnixNano()) / 1e9))),
		QueryString: aws.String(modifiedQueryString),
	}

	if logsQuery.LogGroups != nil && len(logsQuery.LogGroups) > 0 {
		var logGroupIdentifiers []string
		for _, lg := range logsQuery.LogGroups {
			arn := lg.ARN
			// due to a bug in the startQuery api, we remove * from the arn, otherwise it throws an error
			logGroupIdentifiers = append(logGroupIdentifiers, strings.TrimSuffix(arn, "*"))
		}
		startQueryInput.LogGroupIdentifiers = aws.StringSlice(logGroupIdentifiers)
	} else {
		// even though log group names are being phased out, we still need to support them for backwards compatibility and alert queries
		startQueryInput.LogGroupNames = aws.StringSlice(logsQuery.LogGroupNames)
	}

	if logsQuery.Limit != nil {
		startQueryInput.Limit = aws.Int64(*logsQuery.Limit)
	}

	logger.Debug("calling startquery with context with input", "input", startQueryInput)
	return logsClient.StartQueryWithContext(ctx, startQueryInput)
}

func (e *cloudWatchExecutor) handleStartQuery(ctx context.Context, logger log.Logger, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	logsQuery models.LogsQuery, timeRange backend.TimeRange, refID string) (*data.Frame, error) {
	startQueryResponse, err := e.executeStartQuery(ctx, logsClient, logsQuery, timeRange)
	if err != nil {
		var awsErr awserr.Error
		if errors.As(err, &awsErr) && awsErr.Code() == "LimitExceededException" {
			logger.Debug("executeStartQuery limit exceeded", "err", awsErr)
			return nil, &AWSError{Code: limitExceededException, Message: err.Error()}
		}
		return nil, err
	}

	dataFrame := data.NewFrame(refID, data.NewField("queryId", nil, []string{*startQueryResponse.QueryId}))
	dataFrame.RefID = refID

	region := "default"
	if logsQuery.Region != "" {
		region = logsQuery.Region
	}

	dataFrame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
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

	return logsClient.GetQueryResultsWithContext(ctx, queryInput)
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
			groupedFrames, err := groupResults(frame, statsGroups)
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

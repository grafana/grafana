package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"

	cloudwatchLogsTypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
)

var executeLogAnomaliesQuery = func(ctx context.Context, ds *DataSource, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		var anomaliesQuery dataquery.CloudWatchLogsAnomaliesQuery
		err := json.Unmarshal(q.JSON, &anomaliesQuery)
		if err != nil {
			continue
		}

		region := anomaliesQuery.Region
		if region == "" || region == defaultRegion {
			anomaliesQuery.Region = ds.Settings.Region
		}

		logsClient, err := ds.getCWLogsClient(ctx, region)
		if err != nil {
			return nil, err
		}

		listAnomaliesInput := &cloudwatchlogs.ListAnomaliesInput{
			SuppressionState: getSuppressionState(*anomaliesQuery.SuppressionState),
		}

		if anomaliesQuery.AnomalyDetectionARN == nil || *anomaliesQuery.AnomalyDetectionARN != "" {
			listAnomaliesInput.AnomalyDetectorArn = anomaliesQuery.AnomalyDetectionARN
		}

		response, err := logsClient.ListAnomalies(ctx, listAnomaliesInput)

		if err != nil {
			result := backend.NewQueryDataResponse()
			result.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarms", err)))
			return result, nil
		}

		dataframe, err := logsAnomaliesResultsToDataframes(response)
		if err != nil {
			return nil, err
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = data.Frames{dataframe}
		resp.Responses[q.RefID] = respD
	}

	return resp, nil

}

func logsAnomaliesResultsToDataframes(response *cloudwatchlogs.ListAnomaliesOutput) (*data.Frame, error) {
	backend.Logger.Debug("%s response anomalies", response)
	frame := data.NewFrame("Log anomalies")

	if len(response.Anomalies) == 0 {
		return frame, nil
	}

	n := len(response.Anomalies)
	anomalyArns := make([]string, n)
	descriptions := make([]string, n)
	suppressedStatus := make([]bool, n)

	priorities := make([]string, n)
	patterns := make([]string, n)
	statuses := make([]string, n)
	logGroupArnLists := make([]string, n)
	firstSeens := make([]time.Time, n)
	lastSeens := make([]time.Time, n)
	logTrends := make([]*json.RawMessage, n)

	for i, anomaly := range response.Anomalies {
		anomalyArns[i] = *anomaly.AnomalyDetectorArn
		descriptions[i] = *anomaly.Description
		suppressedStatus[i] = *anomaly.Suppressed
		priorities[i] = *anomaly.Priority
		if anomaly.PatternString != nil {
			patterns[i] = *anomaly.PatternString
		}
		statuses[i] = string(anomaly.State)
		logGroupArnLists[i] = strings.Join(anomaly.LogGroupArnList, ",")

		firstSeens[i] = time.UnixMilli(anomaly.FirstSeen)

		lastSeens[i] = time.UnixMilli(anomaly.LastSeen)

		// will be built on the FE for the sparkline table cell
		// b we keep it as JSOn.RawMessage ecause data.Frame returned from the backend cannot contain nested data.Frames
		histogramField := anomaly.Histogram
		histogramJSON, err := json.Marshal(histogramField)
		if err != nil {
			logTrends[i] = nil
		} else {
			rawMsg := json.RawMessage(histogramJSON)
			logTrends[i] = &rawMsg
		}
	}

	newFields := make([]*data.Field, 0, len(response.Anomalies))

	newFields = append(newFields, data.NewField("state", nil, statuses).SetConfig(&data.FieldConfig{DisplayName: "State"}))
	newFields = append(newFields, data.NewField("description", nil, descriptions).SetConfig(&data.FieldConfig{DisplayName: "Anomaly"}))
	newFields = append(newFields, data.NewField("priority", nil, priorities).SetConfig(&data.FieldConfig{DisplayName: "Priority"}))
	newFields = append(newFields, data.NewField("patternString", nil, patterns).SetConfig(&data.FieldConfig{DisplayName: "Log Pattern"}))
	newFields = append(newFields, data.NewField("logTrend", nil, logTrends).SetConfig(&data.FieldConfig{DisplayName: "Log Trend"}))
	newFields = append(newFields, data.NewField("firstSeen", nil, firstSeens).SetConfig(&data.FieldConfig{DisplayName: "First seen"}))
	newFields = append(newFields, data.NewField("lastSeen", nil, lastSeens).SetConfig(&data.FieldConfig{DisplayName: "Last seen"}))
	newFields = append(newFields, data.NewField("suppressed", nil, suppressedStatus).SetConfig(&data.FieldConfig{DisplayName: "Suppressed?"}))
	newFields = append(newFields, data.NewField("logGroupArnList", nil, logGroupArnLists).SetConfig(&data.FieldConfig{DisplayName: "Log Groups"}))
	newFields = append(newFields, data.NewField("anomalyArn", nil, anomalyArns).SetConfig(&data.FieldConfig{DisplayName: "Anomaly Arn"}))

	frame = data.NewFrame("CloudwatchLogsAnomalies", newFields...)
	setPreferredVisType(frame, data.VisTypeTable)
	return frame, nil
}

func getSuppressionState(suppressionState string) cloudwatchLogsTypes.SuppressionState {
	switch suppressionState {
	case "suppressed":
		return cloudwatchLogsTypes.SuppressionStateSuppressed
	case "unsuppressed":
		return cloudwatchLogsTypes.SuppressionStateUnsuppressed
	case "all":
		return ""
	default:
		return ""
	}
}

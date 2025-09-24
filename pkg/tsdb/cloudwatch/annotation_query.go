package cloudwatch

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	cloudwatchtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
)

type annotationEvent struct {
	Title string
	Time  time.Time
	Tags  string
	Text  string
}

func (ds *DataSource) executeAnnotationQuery(ctx context.Context, model DataQueryJson, query backend.DataQuery) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	statistic := ""

	if model.Statistic != nil {
		statistic = *model.Statistic
	}

	var period int32

	if model.Period != nil && *model.Period != "" {
		p, err := strconv.ParseInt(*model.Period, 10, 32)
		if err != nil {
			return nil, backend.DownstreamError(fmt.Errorf("query period must be an int"))
		}
		period = int32(p)
	}

	prefixMatching := false
	if model.PrefixMatching != nil {
		prefixMatching = *model.PrefixMatching
	}
	if period == 0 && !prefixMatching {
		period = 300
	}

	actionPrefix := model.ActionPrefix
	alarmNamePrefix := model.AlarmNamePrefix

	cli, err := ds.getCWClient(ctx, model.Region)
	if err != nil {
		result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(fmt.Errorf("%v: %w", "failed to get client", err))
		return result, nil
	}

	var alarmNames []*string
	metricName := ""
	if model.MetricName != nil {
		metricName = *model.MetricName
	}

	dimensions := dataquery.Dimensions{}
	if model.Dimensions != nil {
		dimensions = *model.Dimensions
	}

	if prefixMatching {
		params := &cloudwatch.DescribeAlarmsInput{
			MaxRecords:      aws.Int32(100),
			ActionPrefix:    actionPrefix,
			AlarmNamePrefix: alarmNamePrefix,
		}
		resp, err := cli.DescribeAlarms(ctx, params)
		if err != nil {
			result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarms", err)))
			return result, nil
		}
		alarmNames = filterAlarms(resp, model.Namespace, metricName, dimensions, statistic, period)
	} else {
		if model.Region == "" || model.Namespace == "" || metricName == "" || statistic == "" {
			return result, backend.DownstreamError(errors.New("invalid annotations query"))
		}

		var qd []cloudwatchtypes.Dimension
		for k, v := range dimensions {
			for _, vvv := range v.ArrayOfString {
				qd = append(qd, cloudwatchtypes.Dimension{
					Name:  aws.String(k),
					Value: aws.String(vvv),
				})
			}
		}
		params := &cloudwatch.DescribeAlarmsForMetricInput{
			Namespace:  aws.String(model.Namespace),
			MetricName: aws.String(metricName),
			Dimensions: qd,
			Statistic:  cloudwatchtypes.Statistic(statistic),
			Period:     aws.Int32(period),
		}
		resp, err := cli.DescribeAlarmsForMetric(ctx, params)
		if err != nil {
			result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarmsForMetric", err)))
			return result, nil
		}
		for _, alarm := range resp.MetricAlarms {
			alarmNames = append(alarmNames, alarm.AlarmName)
		}
	}

	annotations := make([]*annotationEvent, 0)
	for _, alarmName := range alarmNames {
		params := &cloudwatch.DescribeAlarmHistoryInput{
			AlarmName:  alarmName,
			StartDate:  aws.Time(query.TimeRange.From),
			EndDate:    aws.Time(query.TimeRange.To),
			MaxRecords: aws.Int32(100),
		}
		resp, err := cli.DescribeAlarmHistory(ctx, params)
		if err != nil {
			result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarmHistory", err)))
			return result, nil
		}
		for _, history := range resp.AlarmHistoryItems {
			annotations = append(annotations, &annotationEvent{
				Time:  *history.Timestamp,
				Title: *history.AlarmName,
				Tags:  string(history.HistoryItemType),
				Text:  *history.HistorySummary,
			})
		}
	}

	respD := result.Responses[query.RefID]
	respD.Frames = append(respD.Frames, transformAnnotationToTable(annotations, query))
	result.Responses[query.RefID] = respD

	return result, err
}

func transformAnnotationToTable(annotations []*annotationEvent, query backend.DataQuery) *data.Frame {
	frame := data.NewFrame(query.RefID,
		data.NewField("time", nil, []time.Time{}),
		data.NewField("title", nil, []string{}),
		data.NewField("tags", nil, []string{}),
		data.NewField("text", nil, []string{}),
	)

	for _, a := range annotations {
		frame.AppendRow(a.Time, a.Title, a.Tags, a.Text)
	}

	frame.Meta = &data.FrameMeta{
		Custom: map[string]any{
			"rowCount": len(annotations),
		},
	}

	return frame
}

func filterAlarms(alarms *cloudwatch.DescribeAlarmsOutput, namespace string, metricName string,
	dimensions dataquery.Dimensions, statistic string, period int32) []*string {
	alarmNames := make([]*string, 0)

	for _, alarm := range alarms.MetricAlarms {
		if namespace != "" && *alarm.Namespace != namespace {
			continue
		}
		if metricName != "" && *alarm.MetricName != metricName {
			continue
		}

		matchDimension := true
		if len(dimensions) != 0 {
			if len(alarm.Dimensions) != len(dimensions) {
				matchDimension = false
			} else {
				for _, d := range alarm.Dimensions {
					if _, ok := dimensions[*d.Name]; !ok {
						matchDimension = false
					}
				}
			}
		}
		if !matchDimension {
			continue
		}

		if string(alarm.Statistic) != statistic {
			continue
		}

		if period != 0 && *alarm.Period != period {
			continue
		}

		alarmNames = append(alarmNames, alarm.AlarmName)
	}

	return alarmNames
}

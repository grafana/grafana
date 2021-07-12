package cloudwatch

import (
	"context"
	"errors"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func (e *cloudWatchExecutor) executeAnnotationQuery(ctx context.Context, model *simplejson.Json, query backend.DataQuery, pluginCtx backend.PluginContext) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	usePrefixMatch := model.Get("prefixMatching").MustBool(false)
	region := model.Get("region").MustString("")
	namespace := model.Get("namespace").MustString("")
	metricName := model.Get("metricName").MustString("")
	dimensions := model.Get("dimensions").MustMap()
	statistics := parseStatistics(model)
	period := int64(model.Get("period").MustInt(0))
	if period == 0 && !usePrefixMatch {
		period = 300
	}
	actionPrefix := model.Get("actionPrefix").MustString("")
	alarmNamePrefix := model.Get("alarmNamePrefix").MustString("")

	cli, err := e.getCWClient(region, pluginCtx)
	if err != nil {
		return nil, err
	}

	var alarmNames []*string
	if usePrefixMatch {
		params := &cloudwatch.DescribeAlarmsInput{
			MaxRecords:      aws.Int64(100),
			ActionPrefix:    aws.String(actionPrefix),
			AlarmNamePrefix: aws.String(alarmNamePrefix),
		}
		resp, err := cli.DescribeAlarms(params)
		if err != nil {
			return nil, errutil.Wrap("failed to call cloudwatch:DescribeAlarms", err)
		}
		alarmNames = filterAlarms(resp, namespace, metricName, dimensions, statistics, period)
	} else {
		if region == "" || namespace == "" || metricName == "" || len(statistics) == 0 {
			return result, errors.New("invalid annotations query")
		}

		var qd []*cloudwatch.Dimension
		for k, v := range dimensions {
			if vv, ok := v.([]interface{}); ok {
				for _, vvv := range vv {
					if vvvv, ok := vvv.(string); ok {
						qd = append(qd, &cloudwatch.Dimension{
							Name:  aws.String(k),
							Value: aws.String(vvvv),
						})
					}
				}
			}
		}
		for _, s := range statistics {
			params := &cloudwatch.DescribeAlarmsForMetricInput{
				Namespace:  aws.String(namespace),
				MetricName: aws.String(metricName),
				Dimensions: qd,
				Statistic:  aws.String(s),
				Period:     aws.Int64(period),
			}
			resp, err := cli.DescribeAlarmsForMetric(params)
			if err != nil {
				return nil, errutil.Wrap("failed to call cloudwatch:DescribeAlarmsForMetric", err)
			}
			for _, alarm := range resp.MetricAlarms {
				alarmNames = append(alarmNames, alarm.AlarmName)
			}
		}
	}

	annotations := make([]map[string]string, 0)
	for _, alarmName := range alarmNames {
		params := &cloudwatch.DescribeAlarmHistoryInput{
			AlarmName:  alarmName,
			StartDate:  aws.Time(query.TimeRange.From),
			EndDate:    aws.Time(query.TimeRange.To),
			MaxRecords: aws.Int64(100),
		}
		resp, err := cli.DescribeAlarmHistory(params)
		if err != nil {
			return nil, errutil.Wrap("failed to call cloudwatch:DescribeAlarmHistory", err)
		}
		for _, history := range resp.AlarmHistoryItems {
			annotation := make(map[string]string)
			annotation["time"] = history.Timestamp.UTC().Format(time.RFC3339)
			annotation["title"] = *history.AlarmName
			annotation["tags"] = *history.HistoryItemType
			annotation["text"] = *history.HistorySummary
			annotations = append(annotations, annotation)
		}
	}

	respD := result.Responses[query.RefID]
	respD.Frames = append(respD.Frames, transformAnnotationToTable(annotations, query))
	result.Responses[query.RefID] = respD

	return result, err
}

func transformAnnotationToTable(annotations []map[string]string, query backend.DataQuery) *data.Frame {
	frame := data.NewFrame(query.RefID,
		data.NewField("time", nil, []string{}),
		data.NewField("title", nil, []string{}),
		data.NewField("tags", nil, []string{}),
		data.NewField("text", nil, []string{}),
	)

	for _, a := range annotations {
		frame.AppendRow(a["time"], a["title"], a["tags"], a["text"])
	}

	frame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"rowCount": len(annotations),
		},
	}

	return frame
}

func filterAlarms(alarms *cloudwatch.DescribeAlarmsOutput, namespace string, metricName string,
	dimensions map[string]interface{}, statistics []string, period int64) []*string {
	alarmNames := make([]*string, 0)

	for _, alarm := range alarms.MetricAlarms {
		if namespace != "" && *alarm.Namespace != namespace {
			continue
		}
		if metricName != "" && *alarm.MetricName != metricName {
			continue
		}

		match := true
		if len(dimensions) != 0 {
			if len(alarm.Dimensions) != len(dimensions) {
				match = false
			} else {
				for _, d := range alarm.Dimensions {
					if _, ok := dimensions[*d.Name]; !ok {
						match = false
					}
				}
			}
		}
		if !match {
			continue
		}

		if len(statistics) != 0 {
			found := false
			for _, s := range statistics {
				if *alarm.Statistic == s {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		if period != 0 && *alarm.Period != period {
			continue
		}

		alarmNames = append(alarmNames, alarm.AlarmName)
	}

	return alarmNames
}

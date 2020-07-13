package cloudwatch

import (
	"context"
	"errors"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func (e *CloudWatchExecutor) executeAnnotationQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	firstQuery := queryContext.Queries[0]
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: firstQuery.RefId}

	parameters := firstQuery.Model
	usePrefixMatch := parameters.Get("prefixMatching").MustBool(false)
	region := parameters.Get("region").MustString("")
	namespace := parameters.Get("namespace").MustString("")
	metricName := parameters.Get("metricName").MustString("")
	dimensions := parameters.Get("dimensions").MustMap()
	statistics, err := parseStatistics(parameters)
	if err != nil {
		return nil, err
	}
	period := int64(parameters.Get("period").MustInt(0))
	if period == 0 && !usePrefixMatch {
		period = 300
	}
	actionPrefix := parameters.Get("actionPrefix").MustString("")
	alarmNamePrefix := parameters.Get("alarmNamePrefix").MustString("")

	svc, err := e.getClient(region)
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
		resp, err := svc.DescribeAlarms(params)
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
			resp, err := svc.DescribeAlarmsForMetric(params)
			if err != nil {
				return nil, errutil.Wrap("failed to call cloudwatch:DescribeAlarmsForMetric", err)
			}
			for _, alarm := range resp.MetricAlarms {
				alarmNames = append(alarmNames, alarm.AlarmName)
			}
		}
	}

	startTime, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}
	endTime, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	annotations := make([]map[string]string, 0)
	for _, alarmName := range alarmNames {
		params := &cloudwatch.DescribeAlarmHistoryInput{
			AlarmName:  alarmName,
			StartDate:  aws.Time(startTime),
			EndDate:    aws.Time(endTime),
			MaxRecords: aws.Int64(100),
		}
		resp, err := svc.DescribeAlarmHistory(params)
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

	transformAnnotationToTable(annotations, queryResult)
	result.Results[firstQuery.RefId] = queryResult
	return result, err
}

func transformAnnotationToTable(data []map[string]string, result *tsdb.QueryResult) {
	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, 4),
		Rows:    make([]tsdb.RowValues, 0),
	}
	table.Columns[0].Text = "time"
	table.Columns[1].Text = "title"
	table.Columns[2].Text = "tags"
	table.Columns[3].Text = "text"

	for _, r := range data {
		values := make([]interface{}, 4)
		values[0] = r["time"]
		values[1] = r["title"]
		values[2] = r["tags"]
		values[3] = r["text"]
		table.Rows = append(table.Rows, values)
	}
	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", len(data))
}

func filterAlarms(alarms *cloudwatch.DescribeAlarmsOutput, namespace string, metricName string, dimensions map[string]interface{}, statistics []string, period int64) []*string {
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

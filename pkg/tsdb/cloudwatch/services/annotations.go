package services

import (
	"fmt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

type AnnotationService struct {
	models.MetricsClientProvider
}

func NewAnnotationService(metricClient models.MetricsClientProvider) models.AnnotationProvider {
	return &AnnotationService{metricClient}
}

func (s *AnnotationService) GetAnnotationEvents(timeRange backend.TimeRange, alarmNames []*string) (models.AnnotationEvents, error) {
	annotations := make([]*models.AnnotationEvent, 0)
	for _, alarmName := range alarmNames {
		params := &cloudwatch.DescribeAlarmHistoryInput{
			AlarmName:  alarmName,
			StartDate:  aws.Time(timeRange.From),
			EndDate:    aws.Time(timeRange.To),
			MaxRecords: aws.Int64(100),
		}
		resp, err := s.MetricsClientProvider.DescribeAlarmHistory(params)
		if err != nil {
			return nil, fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarmHistory", err)
		}

		for _, history := range resp.AlarmHistoryItems {
			annotations = append(annotations, &models.AnnotationEvent{
				Time:  *history.Timestamp,
				Title: *history.AlarmName,
				Tags:  *history.HistoryItemType,
				Text:  *history.HistorySummary,
			})
		}
	}

	return annotations, nil
}

func (s *AnnotationService) GetAlarmNamesByMetric(query *models.AnnotationQuery) ([]*string, error) {
	var qd []*cloudwatch.Dimension
	for k, v := range query.Dimensions {
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
	params := &cloudwatch.DescribeAlarmsForMetricInput{
		Namespace:  aws.String(query.Namespace),
		MetricName: aws.String(query.MetricName),
		Dimensions: qd,
		Statistic:  aws.String(query.Statistic),
		Period:     aws.Int64(query.PeriodInt),
	}
	resp, err := s.MetricsClientProvider.DescribeAlarmsForMetric(params)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarmsForMetric", err)
	}

	var alarmNames []*string
	for _, alarm := range resp.MetricAlarms {
		alarmNames = append(alarmNames, alarm.AlarmName)
	}

	return alarmNames, nil
}

func (s *AnnotationService) GetAlarmNamesByPrefixMatching(query *models.AnnotationQuery) ([]*string, error) {
	params := &cloudwatch.DescribeAlarmsInput{
		MaxRecords:      aws.Int64(100),
		ActionPrefix:    aws.String(query.ActionPrefix),
		AlarmNamePrefix: aws.String(query.AlarmNamePrefix),
	}
	resp, err := s.MetricsClientProvider.DescribeAlarms(params)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarms", err)
	}

	return filterAlarms(resp, query.Namespace, query.MetricName, query.Dimensions, query.Statistic, query.PeriodInt), nil
}

func filterAlarms(alarms *cloudwatch.DescribeAlarmsOutput, namespace string, metricName string,
	dimensions map[string]interface{}, statistic string, period int64) []*string {
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

		if *alarm.Statistic != statistic {
			continue
		}

		if period != 0 && *alarm.Period != period {
			continue
		}

		alarmNames = append(alarmNames, alarm.AlarmName)
	}

	return alarmNames
}

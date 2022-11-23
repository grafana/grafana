package mocks

import (
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

var AnnotationQuery models.AnnotationQuery = models.AnnotationQuery{
	PrefixMatching:  false,
	Region:          "us-east-2",
	Namespace:       "EC2",
	MetricName:      "CPUUtilization",
	Statistic:       "Average",
	Period:          "300",
	ActionPrefix:    "",
	AlarmNamePrefix: "",
}

func GetDataQuery(annotationQueryJson string) backend.DataQuery {
	return backend.DataQuery{
		RefID:         "A",
		QueryType:     "annotation",
		MaxDataPoints: 0,
		Interval:      0,
		TimeRange:     backend.TimeRange{},
		JSON:          []byte(annotationQueryJson),
	}
}

var QueryWithWrongDataType = `{
	"type":    "annotationQuery",
	"region":    123,
	"namespace": "EC2",
	"metricName": "CPUUtilization",
	"statistic": "Average",
	"prefixMatching": false,
	"actionPrefix": "",
	"actionPrefixName": "",
	"dimensions": {
		"InstanceId": "i-1234567890abcdef0"
	}
}`

var StandardQuery = `{
	"type":    "annotationQuery",
	"region":    "us-east-2",
	"namespace": "EC2",
	"metricName": "CPUUtilization",
	"statistic": "Average",
	"prefixMatching": false,
	"actionPrefix": "",
	"actionPrefixName": "",
	"dimensions": {
		"InstanceId": "i-1234567890abcdef0"
	}
}`

var PrefixMatchingQuery = `{
	"type":    "annotationQuery",
	"region":    "us-east-2",
	"namespace": "EC2",
	"metricName": "CPUUtilization",
	"statistic": "Average",
	"prefixMatching": true,
	"actionPrefix": "arn:",
	"actionPrefixName": "test-"
}`

var AlarmOutputs = &cloudwatch.DescribeAlarmsOutput{
	MetricAlarms: []*cloudwatch.MetricAlarm{
		{
			Namespace: aws.String("EC2"),
			Statistic: aws.String("Average"),
			Dimensions: []*cloudwatch.Dimension{
				{
					Name:  aws.String("InstanceType"),
					Value: aws.String("test"),
				},
			},
			MetricName: aws.String("CPUUtilization"),
			Period:     aws.Int64(60),
		},
		{
			Namespace: aws.String("EC2"),
			Statistic: aws.String("Sum"),
			Dimensions: []*cloudwatch.Dimension{
				{
					Name:  aws.String("InstanceId"),
					Value: aws.String("i-123"),
				},
			},
			MetricName: aws.String("CPUUtilization"),
			Period:     aws.Int64(300),
		},
		{
			Namespace: aws.String("EC2"),
			Statistic: aws.String("Sum"),
			Dimensions: []*cloudwatch.Dimension{
				{
					Name:  aws.String("InstanceId"),
					Value: aws.String("i-123"),
				},
			},
			MetricName: aws.String("CPUUtilization"),
			Period:     aws.Int64(300),
		},
		{
			Namespace: aws.String("EC2"),
			Statistic: aws.String("Sum"),
			Dimensions: []*cloudwatch.Dimension{
				{
					Name:  aws.String("InstanceId"),
					Value: aws.String("i-123"),
				},
			},
			MetricName: aws.String("DroppedBytes"),
			Period:     aws.Int64(3000),
		},
	}}

package cloudwatch

import (
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloudWatchResponseParser(t *testing.T) {
	t.Run("Expand dimension value using exact match", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		labels := []string{"lb1", "lb2"}
		mdrs := map[string]*cloudwatch.MetricDataResult{
			"lb1": {
				Id:    aws.String("id1"),
				Label: aws.String("lb1"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values: []*float64{
					aws.Float64(10),
					aws.Float64(20),
					aws.Float64(30),
				},
				StatusCode: aws.String("Complete"),
			},
			"lb2": {
				Id:    aws.String("id2"),
				Label: aws.String("lb2"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values: []*float64{
					aws.Float64(10),
					aws.Float64(20),
					aws.Float64(30),
				},
				StatusCode: aws.String("Complete"),
			},
		}

		query := &cloudWatchQuery{
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1", "lb2"},
				"TargetGroup":  {"tg"},
			},
			Stats:  "Average",
			Period: 60,
			Alias:  "{{LoadBalancer}} Expanded",
		}
		series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)
		timeSeries := (*series)[0]

		require.Nil(t, err)
		assert.False(t, partialData)
		assert.Equal(t, timeSeries.Name, "lb1 Expanded")
		assert.Equal(t, timeSeries.Tags["LoadBalancer"], "lb1")

		timeSeries2 := (*series)[1]
		assert.Equal(t, timeSeries2.Name, "lb2 Expanded")
		assert.Equal(t, timeSeries2.Tags["LoadBalancer"], "lb2")
	})

	t.Run("Expand dimension value using substring", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		labels := []string{"lb1 Sum", "lb2 Average"}
		mdrs := map[string]*cloudwatch.MetricDataResult{
			"lb1 Sum": {
				Id:    aws.String("id1"),
				Label: aws.String("lb1 Sum"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values: []*float64{
					aws.Float64(10),
					aws.Float64(20),
					aws.Float64(30),
				},
				StatusCode: aws.String("Complete"),
			},
			"lb2 Average": {
				Id:    aws.String("id2"),
				Label: aws.String("lb2 Average"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values: []*float64{
					aws.Float64(10),
					aws.Float64(20),
					aws.Float64(30),
				},
				StatusCode: aws.String("Complete"),
			},
		}

		query := &cloudWatchQuery{
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1", "lb2"},
				"TargetGroup":  {"tg"},
			},
			Stats:  "Average",
			Period: 60,
			Alias:  "{{LoadBalancer}} Expanded",
		}
		series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)
		timeSeries := (*series)[0]
		require.Nil(t, err)
		assert.False(t, partialData)
		assert.Equal(t, timeSeries.Name, "lb1 Expanded")
		assert.Equal(t, timeSeries.Tags["LoadBalancer"], "lb1")

		timeSeries2 := (*series)[1]
		assert.Equal(t, timeSeries2.Name, "lb2 Expanded")
		assert.Equal(t, timeSeries2.Tags["LoadBalancer"], "lb2")
	})

	t.Run("Expand dimension value using wildcard", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		labels := []string{"lb3", "lb4"}
		mdrs := map[string]*cloudwatch.MetricDataResult{
			"lb3": {
				Id:    aws.String("lb3"),
				Label: aws.String("lb3"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values: []*float64{
					aws.Float64(10),
					aws.Float64(20),
					aws.Float64(30),
				},
				StatusCode: aws.String("Complete"),
			},
			"lb4": {
				Id:    aws.String("lb4"),
				Label: aws.String("lb4"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values: []*float64{
					aws.Float64(10),
					aws.Float64(20),
					aws.Float64(30),
				},
				StatusCode: aws.String("Complete"),
			},
		}

		query := &cloudWatchQuery{
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"*"},
				"TargetGroup":  {"tg"},
			},
			Stats:  "Average",
			Period: 60,
			Alias:  "{{LoadBalancer}} Expanded",
		}
		series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)

		require.Nil(t, err)
		assert.False(t, partialData)
		assert.Equal(t, (*series)[0].Name, "lb3 Expanded")
		assert.Equal(t, (*series)[1].Name, "lb4 Expanded")
	})

	t.Run("Expand dimension value when no values are returned and a multi-valued template variable is used", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		labels := []string{"lb3"}
		mdrs := map[string]*cloudwatch.MetricDataResult{
			"lb3": {
				Id:    aws.String("lb3"),
				Label: aws.String("lb3"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values:     []*float64{},
				StatusCode: aws.String("Complete"),
			},
		}

		query := &cloudWatchQuery{
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1", "lb2"},
			},
			Stats:  "Average",
			Period: 60,
			Alias:  "{{LoadBalancer}} Expanded",
		}
		series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)

		require.Nil(t, err)
		assert.False(t, partialData)
		assert.Equal(t, len(*series), 2)
		assert.Equal(t, (*series)[0].Name, "lb1 Expanded")
		assert.Equal(t, (*series)[1].Name, "lb2 Expanded")
	})

	t.Run("Expand dimension value when no values are returned and a multi-valued template variable and two single-valued dimensions are used", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		labels := []string{"lb3"}
		mdrs := map[string]*cloudwatch.MetricDataResult{
			"lb3": {
				Id:    aws.String("lb3"),
				Label: aws.String("lb3"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values:     []*float64{},
				StatusCode: aws.String("Complete"),
			},
		}

		query := &cloudWatchQuery{
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1", "lb2"},
				"InstanceType": {"micro"},
				"Resource":     {"res"},
			},
			Stats:  "Average",
			Period: 60,
			Alias:  "{{LoadBalancer}} Expanded {{InstanceType}} - {{Resource}}",
		}
		series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)

		require.Nil(t, err)
		assert.False(t, partialData)
		assert.Equal(t, len(*series), 2)
		assert.Equal(t, (*series)[0].Name, "lb1 Expanded micro - res")
		assert.Equal(t, (*series)[1].Name, "lb2 Expanded micro - res")
	})

	t.Run("Parse cloudwatch response", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		labels := []string{"lb"}
		mdrs := map[string]*cloudwatch.MetricDataResult{
			"lb": {
				Id:    aws.String("id1"),
				Label: aws.String("lb"),
				Timestamps: []*time.Time{
					aws.Time(timestamp),
					aws.Time(timestamp.Add(60 * time.Second)),
					aws.Time(timestamp.Add(180 * time.Second)),
				},
				Values: []*float64{
					aws.Float64(10),
					aws.Float64(20),
					aws.Float64(30),
				},
				StatusCode: aws.String("Complete"),
			},
		}

		query := &cloudWatchQuery{
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb"},
				"TargetGroup":  {"tg"},
			},
			Stats:  "Average",
			Period: 60,
			Alias:  "{{namespace}}_{{metric}}_{{stat}}",
		}
		series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)
		timeSeries := (*series)[0]

		require.Nil(t, err)
		assert.False(t, partialData)
		assert.Equal(t, timeSeries.Name, "AWS/ApplicationELB_TargetResponseTime_Average")
		assert.Equal(t, timeSeries.Tags["LoadBalancer"], "lb")
		assert.Equal(t, timeSeries.Points[0][0].String(), null.FloatFrom(10.0).String())
		assert.Equal(t, timeSeries.Points[1][0].String(), null.FloatFrom(20.0).String())
		assert.Equal(t, timeSeries.Points[2][0].String(), null.FloatFromPtr(nil).String())
		assert.Equal(t, timeSeries.Points[3][0].String(), null.FloatFrom(30.0).String())
	})
}

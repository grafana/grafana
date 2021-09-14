package cloudwatch

import (
	"encoding/json"
	"io/ioutil"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func loadGetMetricDataOutputsFromFile() ([]*cloudwatch.GetMetricDataOutput, error) {
	var getMetricDataOutputs []*cloudwatch.GetMetricDataOutput
	jsonBody, err := ioutil.ReadFile("./test-data/multiple-outputs.json")
	if err != nil {
		return getMetricDataOutputs, err
	}
	err = json.Unmarshal(jsonBody, &getMetricDataOutputs)
	return getMetricDataOutputs, err
}

func TestCloudWatchResponseParser(t *testing.T) {
	startTime := time.Now()
	endTime := startTime.Add(2 * time.Hour)
	t.Run("when aggregating response", func(t *testing.T) {
		getMetricDataOutputs, err := loadGetMetricDataOutputsFromFile()
		require.NoError(t, err)
		aggregatedResponse := aggregateResponse(getMetricDataOutputs)
		t.Run("response for id a", func(t *testing.T) {
			idA := "a"
			t.Run("should have two labels", func(t *testing.T) {
				assert.Len(t, aggregatedResponse[idA].Labels, 2)
				assert.Len(t, aggregatedResponse[idA].Metrics, 2)
			})
			t.Run("should have points for label1 taken from both getMetricDataOutputs", func(t *testing.T) {
				assert.Len(t, aggregatedResponse[idA].Metrics["label1"].Values, 10)
			})
			t.Run("should have statuscode 'Complete'", func(t *testing.T) {
				assert.Equal(t, "Complete", aggregatedResponse[idA].StatusCode)
			})
			t.Run("should have exceeded request limit", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].RequestExceededMaxLimit)
			})
		})
		t.Run("response for id b", func(t *testing.T) {
			idB := "b"
			t.Run("should have statuscode is 'Partial'", func(t *testing.T) {
				assert.Equal(t, "Partial", aggregatedResponse[idB].StatusCode)
			})
			t.Run("should have an arithmetic error and an error message", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idB].HasArithmeticError)
				assert.Equal(t, "One or more data-points have been dropped due to non-numeric values (NaN, -Infinite, +Infinite)", aggregatedResponse[idB].ArithmeticErrorMessage)
			})
		})
	})

	t.Run("Expand dimension value using exact match", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &queryRowResponse{
			Labels: []string{"lb1", "lb2"},
			Metrics: map[string]*cloudwatch.MetricDataResult{
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
			Statistic: "Average",
			Period:    60,
			Alias:     "{{LoadBalancer}} Expanded",
		}
		frames, err := buildDataFrames(startTime, endTime, *response, query)
		require.NoError(t, err)

		frame1 := frames[0]
		assert.Equal(t, "lb1 Expanded", frame1.Name)
		assert.Equal(t, "lb1", frame1.Fields[1].Labels["LoadBalancer"])

		frame2 := frames[1]
		assert.Equal(t, "lb2 Expanded", frame2.Name)
		assert.Equal(t, "lb2", frame2.Fields[1].Labels["LoadBalancer"])
	})

	t.Run("Expand dimension value using substring", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &queryRowResponse{
			Labels: []string{"lb1 Sum", "lb2 Average"},
			Metrics: map[string]*cloudwatch.MetricDataResult{
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
			}}

		query := &cloudWatchQuery{
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1", "lb2"},
				"TargetGroup":  {"tg"},
			},
			Statistic: "Average",
			Period:    60,
			Alias:     "{{LoadBalancer}} Expanded",
		}
		frames, err := buildDataFrames(startTime, endTime, *response, query)
		require.NoError(t, err)

		frame1 := frames[0]
		assert.Equal(t, "lb1 Expanded", frame1.Name)
		assert.Equal(t, "lb1", frame1.Fields[1].Labels["LoadBalancer"])

		frame2 := frames[1]
		assert.Equal(t, "lb2 Expanded", frame2.Name)
		assert.Equal(t, "lb2", frame2.Fields[1].Labels["LoadBalancer"])
	})

	t.Run("Expand dimension value using wildcard", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &queryRowResponse{
			Labels: []string{"lb3", "lb4"},
			Metrics: map[string]*cloudwatch.MetricDataResult{
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
			Statistic: "Average",
			Period:    60,
			Alias:     "{{LoadBalancer}} Expanded",
		}
		frames, err := buildDataFrames(startTime, endTime, *response, query)
		require.NoError(t, err)

		assert.Equal(t, "lb3 Expanded", frames[0].Name)
		assert.Equal(t, "lb4 Expanded", frames[1].Name)
	})

	t.Run("Expand dimension value when no values are returned and a multi-valued template variable is used", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &queryRowResponse{
			Labels: []string{"lb3"},
			Metrics: map[string]*cloudwatch.MetricDataResult{
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
			Statistic: "Average",
			Period:    60,
			Alias:     "{{LoadBalancer}} Expanded",
		}
		frames, err := buildDataFrames(startTime, endTime, *response, query)
		require.NoError(t, err)

		assert.Len(t, frames, 2)
		assert.Equal(t, "lb1 Expanded", frames[0].Name)
		assert.Equal(t, "lb2 Expanded", frames[1].Name)
	})

	t.Run("Expand dimension value when no values are returned and a multi-valued template variable and two single-valued dimensions are used", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &queryRowResponse{
			Labels: []string{"lb3"},
			Metrics: map[string]*cloudwatch.MetricDataResult{
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
			Statistic: "Average",
			Period:    60,
			Alias:     "{{LoadBalancer}} Expanded {{InstanceType}} - {{Resource}}",
		}
		frames, err := buildDataFrames(startTime, endTime, *response, query)
		require.NoError(t, err)

		assert.Len(t, frames, 2)
		assert.Equal(t, "lb1 Expanded micro - res", frames[0].Name)
		assert.Equal(t, "lb2 Expanded micro - res", frames[1].Name)
	})

	t.Run("Parse cloudwatch response", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &queryRowResponse{
			Labels: []string{"lb"},
			Metrics: map[string]*cloudwatch.MetricDataResult{
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
			Statistic: "Average",
			Period:    60,
			Alias:     "{{namespace}}_{{metric}}_{{stat}}",
		}
		frames, err := buildDataFrames(startTime, endTime, *response, query)
		require.NoError(t, err)

		frame := frames[0]
		assert.Equal(t, "AWS/ApplicationELB_TargetResponseTime_Average", frame.Name)
		assert.Equal(t, "Time", frame.Fields[0].Name)
		assert.Equal(t, "lb", frame.Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, 10.0, *frame.Fields[1].At(0).(*float64))
		assert.Equal(t, 20.0, *frame.Fields[1].At(1).(*float64))
		assert.Nil(t, frame.Fields[1].At(2))
		assert.Equal(t, 30.0, *frame.Fields[1].At(3).(*float64))
		assert.Equal(t, "Value", frame.Fields[1].Name)
		assert.Equal(t, "", frame.Fields[1].Config.DisplayName)
	})
}

package services

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAnnotationsService(t *testing.T) {

	type testCase struct {
		query         models.AnnotationQuery
		exectedLength int
	}

	tests := []testCase{
		{
			query: models.AnnotationQuery{
				Namespace:  "EC2",
				MetricName: "CPUUtilization",
				Statistic:  "Average",
				PeriodInt:  60,
				Dimensions: map[string]interface{}{
					"InstanceType": "test",
				},
			},
			exectedLength: 1,
		},
		{
			query: models.AnnotationQuery{
				Namespace:  "EC2",
				MetricName: "CPUUtilization",
				Statistic:  "Sum",
				PeriodInt:  300,
				Dimensions: map[string]interface{}{
					"InstanceId": "i-123",
				},
			},
			exectedLength: 2,
		},
	}

	for _, tc := range tests {
		t.Run("Should return unmarshal error when incorrect data type are used in json", func(t *testing.T) {
			mockClient := &mocks.FakeMetricsClient{
				// DescribeAlarmOutput: mocks.AlarmOutputs,
			}
			annotationService := NewAnnotationService(mockClient)
			alarms, err := annotationService.GetAlarmNamesByPrefixMatching(&tc.query)
			require.NoError(t, err)
			assert.Len(t, alarms, tc.exectedLength)
		})
	}
}

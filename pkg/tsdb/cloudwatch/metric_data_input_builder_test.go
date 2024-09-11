package cloudwatch

import (
	"context"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func TestMetricDataInputBuilder(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name                 string
		timezoneUTCOffset    string
		expectedLabelOptions *cloudwatch.LabelOptions
	}{
		{name: "when timezoneUTCOffset is provided", timezoneUTCOffset: "+1234", expectedLabelOptions: &cloudwatch.LabelOptions{Timezone: aws.String("+1234")}},
		{name: "when timezoneUTCOffset is not provided", timezoneUTCOffset: "", expectedLabelOptions: nil},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			executor := newExecutor(nil, log.NewNullLogger())
			query := getBaseQuery()
			query.TimezoneUTCOffset = tc.timezoneUTCOffset

			from := now.Add(time.Hour * -2)
			to := now.Add(time.Hour * -1)
			mdi, err := executor.buildMetricDataInput(context.Background(), from, to, []*models.CloudWatchQuery{query})

			assert.NoError(t, err)
			require.NotNil(t, mdi)
			assert.Equal(t, tc.expectedLabelOptions, mdi.LabelOptions)
		})
	}
}

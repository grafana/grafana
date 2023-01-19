package cloudwatch

import (
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func TestMetricDataInputBuilder(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name                 string
		timezoneUTCOffset    string
		expectedLabelOptions *cloudwatch.LabelOptions
		featureEnabled       bool
	}{
		{name: "when timezoneUTCOffset is provided and feature is enabled", timezoneUTCOffset: "+1234", expectedLabelOptions: &cloudwatch.LabelOptions{Timezone: aws.String("+1234")}, featureEnabled: true},
		{name: "when timezoneUTCOffset is not provided and feature is enabled", timezoneUTCOffset: "", expectedLabelOptions: nil, featureEnabled: true},
		{name: "when timezoneUTCOffset is provided and feature is disabled", timezoneUTCOffset: "+1234", expectedLabelOptions: nil, featureEnabled: false},
		{name: "when timezoneUTCOffset is not provided and feature is disabled", timezoneUTCOffset: "", expectedLabelOptions: nil, featureEnabled: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			executor := newExecutor(nil, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures(featuremgmt.FlagCloudWatchDynamicLabels, tc.featureEnabled))
			query := getBaseQuery()
			query.TimezoneUTCOffset = tc.timezoneUTCOffset

			from := now.Add(time.Hour * -2)
			to := now.Add(time.Hour * -1)
			mdi, err := executor.buildMetricDataInput(logger, from, to, []*models.CloudWatchQuery{query})

			assert.NoError(t, err)
			require.NotNil(t, mdi)
			assert.Equal(t, tc.expectedLabelOptions, mdi.LabelOptions)
		})
	}
}

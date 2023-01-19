package clients

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricsClient(t *testing.T) {
	metrics := []*cloudwatch.Metric{
		{MetricName: aws.String("Test_MetricName1")},
		{MetricName: aws.String("Test_MetricName2")},
		{MetricName: aws.String("Test_MetricName3")},
		{MetricName: aws.String("Test_MetricName4")},
		{MetricName: aws.String("Test_MetricName5")},
		{MetricName: aws.String("Test_MetricName6")},
		{MetricName: aws.String("Test_MetricName7")},
		{MetricName: aws.String("Test_MetricName8")},
		{MetricName: aws.String("Test_MetricName9")},
		{MetricName: aws.String("Test_MetricName10")},
	}

	t.Run("List Metrics and page limit is reached", func(t *testing.T) {
		pageLimit := 3
		fakeApi := &mocks.FakeMetricsAPI{Metrics: metrics, MetricsPerPage: 2}
		client := NewMetricsClient(fakeApi, &setting.Cfg{AWSListMetricsPageLimit: pageLimit})
		response, err := client.ListMetricsWithPageLimit(&cloudwatch.ListMetricsInput{})
		require.NoError(t, err)

		expectedMetrics := fakeApi.MetricsPerPage * pageLimit
		assert.Equal(t, expectedMetrics, len(response))
	})

	t.Run("List Metrics and page limit is not reached", func(t *testing.T) {
		pageLimit := 2
		fakeApi := &mocks.FakeMetricsAPI{Metrics: metrics}
		client := NewMetricsClient(fakeApi, &setting.Cfg{AWSListMetricsPageLimit: pageLimit})

		response, err := client.ListMetricsWithPageLimit(&cloudwatch.ListMetricsInput{})
		require.NoError(t, err)

		assert.Equal(t, len(metrics), len(response))
	})

	t.Run("Should return account id in case IncludeLinkedAccounts is set to true", func(t *testing.T) {
		fakeApi := &mocks.FakeMetricsAPI{Metrics: []*cloudwatch.Metric{
			{MetricName: aws.String("Test_MetricName1")},
			{MetricName: aws.String("Test_MetricName2")},
			{MetricName: aws.String("Test_MetricName3")},
		}, OwningAccounts: []*string{aws.String("1234567890"), aws.String("1234567890"), aws.String("1234567895")}}
		client := NewMetricsClient(fakeApi, &setting.Cfg{AWSListMetricsPageLimit: 100})

		response, err := client.ListMetricsWithPageLimit(&cloudwatch.ListMetricsInput{IncludeLinkedAccounts: aws.Bool(true)})
		require.NoError(t, err)
		expected := []resources.MetricResponse{
			{Metric: &cloudwatch.Metric{MetricName: aws.String("Test_MetricName1")}, AccountId: stringPtr("1234567890")},
			{Metric: &cloudwatch.Metric{MetricName: aws.String("Test_MetricName2")}, AccountId: stringPtr("1234567890")},
			{Metric: &cloudwatch.Metric{MetricName: aws.String("Test_MetricName3")}, AccountId: stringPtr("1234567895")},
		}
		assert.Equal(t, expected, response)
	})

	t.Run("Should not return account id in case IncludeLinkedAccounts is set to false", func(t *testing.T) {
		fakeApi := &mocks.FakeMetricsAPI{Metrics: []*cloudwatch.Metric{{MetricName: aws.String("Test_MetricName1")}}, OwningAccounts: []*string{aws.String("1234567890")}}
		client := NewMetricsClient(fakeApi, &setting.Cfg{AWSListMetricsPageLimit: 100})

		response, err := client.ListMetricsWithPageLimit(&cloudwatch.ListMetricsInput{IncludeLinkedAccounts: aws.Bool(false)})
		require.NoError(t, err)
		assert.Nil(t, response[0].AccountId)
	})
}

func stringPtr(s string) *string { return &s }

package cloudwatch

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	cloudwatchLogsTypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
)

func Test_executeLogAnomaliesQuery(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var cli fakeCWLogsClient
	NewCWLogsClient = func(aws.Config) models.CWLogsClient {
		return &cli
	}

	t.Run("getCWLogsClient is called with correct suppression state", func(t *testing.T) {
		testcases := []struct {
			name                    string
			suppressionStateInQuery string
			result                  cloudwatchlogstypes.SuppressionState
		}{
			{
				"suppressed state",
				"suppressed",
				cloudwatchLogsTypes.SuppressionStateSuppressed,
			},
			{
				"unsuppressed state",
				"unsuppressed",
				cloudwatchLogsTypes.SuppressionStateUnsuppressed,
			},
			{
				"empty state",
				"",
				"",
			},
			{
				"all state",
				"all",
				"",
			},
		}

		for _, tc := range testcases {
			t.Run(tc.name, func(t *testing.T) {
				cli = fakeCWLogsClient{anomalies: []cloudwatchlogstypes.Anomaly{}}
				ds := newTestDatasource()

				_, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
					Headers:       map[string]string{headerFromAlert: ""},
					PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
					Queries: []backend.DataQuery{
						{
							TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
							JSON: json.RawMessage(`{
						"queryMode":    "Logs",
						"logsMode": "Anomalies",
						"suppressionState": "` + tc.suppressionStateInQuery + `",
						"region": "us-east-1"
						}`),
						},
					},
				})

				assert.NoError(t, err)
				assert.Equal(t, tc.result, cli.calls.listAnomalies[0].SuppressionState)
			})
		}
	})
}

func Test_executeLogAnomaliesQuery_returns_data_frames(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var cli fakeCWLogsClient
	NewCWLogsClient = func(aws.Config) models.CWLogsClient {
		return &cli
	}
	t.Run("returns log anomalies data frames", func(t *testing.T) {
		cli = fakeCWLogsClient{anomalies: []cloudwatchlogstypes.Anomaly{
			{
				AnomalyId:          aws.String("anomaly-1"),
				AnomalyDetectorArn: aws.String("arn:aws:logs:us-east-1:123456789012:anomaly-detector:anomaly-detector-1"),
				FirstSeen:          1622505600000, // June 1, 2021 00:00:00 GMT
				LastSeen:           1622592000000, // June 2, 2021 00:00:00 GMT
				LogGroupArnList:    []string{"arn:aws:logs:us-east-1:1234567:log-group-1:id-1", "arn:aws:logs:us-east-1:1234567:log-group-2:id-2"},
				Description:        aws.String("Description 1"),
				State:              cloudwatchLogsTypes.StateActive,
				Priority:           aws.String("high"),
				PatternString:      aws.String(`{"ClusterName":"PetSite","Namespace":"default","Service":"service-petsite",,"instance":"instance"-5:Token-6,"job":"kubernetes-service-endpoints","pod_name":"pod_name"-9,"prom_metric_type":"counter"}`),
				Suppressed:         aws.Bool(false),
				Histogram: map[string]int64{
					"1622505600000": 5,
					"1622519200000": 10,
					"1622532800000": 7,
				},
			},
			{
				AnomalyId:          aws.String("anomaly-2"),
				AnomalyDetectorArn: aws.String("arn:aws:logs:us-east-1:123456789012:anomaly-detector:anomaly-detector-2"),
				FirstSeen:          1622592000000, // June 2, 2021 00:00:00 GMT
				LastSeen:           1622678400000, // June 3, 2021 00:00:00 GMT
				LogGroupArnList:    []string{"arn:aws:logs:us-east-1:1234567:log-group-1:id-3", "arn:aws:logs:us-east-1:1234567:log-group-2:id-4"},
				Description:        aws.String("Description 2"),
				State:              cloudwatchLogsTypes.StateSuppressed,
				Priority:           aws.String("low"),
				PatternString:      aws.String(`{"ClusterName":"PetSite","Namespace":"default","Service":"service-petsite","dotnet_collection_count_total":"dotnet_collection_count_total"-3}`),
				Suppressed:         aws.Bool(true),
				Histogram: map[string]int64{
					"1622592000000": 3,
				},
			},
		}}

		ds := newTestDatasource()

		resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
			Headers:       map[string]string{headerFromAlert: ""},
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
				"queryMode":    "Logs",
				"logsMode": "Anomalies",
				"suppressionState": "all",
				"region": "us-east-1"
				}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Len(t, resp.Responses, 1)
		for _, r := range resp.Responses {
			assert.Len(t, r.Frames, 1)
			frame := r.Frames[0]
			assert.Equal(t, "CloudwatchLogsAnomalies", frame.Name)
			assert.Len(t, frame.Fields, 9)

			stateField := frame.Fields[0]
			assert.Equal(t, "state", stateField.Name)
			assert.Equal(t, "Active", stateField.At(0))
			assert.Equal(t, "Suppressed", stateField.At(1))

			descriptionField := frame.Fields[1]
			assert.Equal(t, "description", descriptionField.Name)
			assert.Equal(t, "Description 1", descriptionField.At(0))
			assert.Equal(t, "Description 2", descriptionField.At(1))

			priorityField := frame.Fields[2]
			assert.Equal(t, "priority", priorityField.Name)
			assert.Equal(t, "high", priorityField.At(0))
			assert.Equal(t, "low", priorityField.At(1))

			patternStringField := frame.Fields[3]
			assert.Equal(t, "patternString", patternStringField.Name)
			assert.Equal(t, `{"ClusterName":"PetSite","Namespace":"default","Service":"service-petsite",,"instance":"instance"-5:Token-6,"job":"kubernetes-service-endpoints","pod_name":"pod_name"-9,"prom_metric_type":"counter"}`, patternStringField.At(0))
			assert.Equal(t, `{"ClusterName":"PetSite","Namespace":"default","Service":"service-petsite","dotnet_collection_count_total":"dotnet_collection_count_total"-3}`, patternStringField.At(1))

			histogramField := frame.Fields[4]
			assert.Equal(t, "logTrend", histogramField.Name)

			histogram0 := histogramField.At(0).(*json.RawMessage)
			var histData0 map[string]int64
			err = json.Unmarshal(*histogram0, &histData0)
			assert.NoError(t, err)
			assert.Equal(t, int64(5), histData0["1622505600000"])
			assert.Equal(t, int64(10), histData0["1622519200000"])
			assert.Equal(t, int64(7), histData0["1622532800000"])

			firstSeenField := frame.Fields[5]
			assert.Equal(t, "firstSeen", firstSeenField.Name)
			assert.Equal(t, time.Unix(1622505600, 0), firstSeenField.At(0))
			assert.Equal(t, time.Unix(1622592000, 0), firstSeenField.At(1))

			lastSeenField := frame.Fields[6]
			assert.Equal(t, "lastSeen", lastSeenField.Name)
			assert.Equal(t, time.Unix(1622592000, 0), lastSeenField.At(0))
			assert.Equal(t, time.Unix(1622678400, 0), lastSeenField.At(1))

			suppressedField := frame.Fields[7]
			assert.Equal(t, "suppressed", suppressedField.Name)
			assert.Equal(t, false, suppressedField.At(0))
			assert.Equal(t, true, suppressedField.At(1))

			logGroupArnListField := frame.Fields[8]
			assert.Equal(t, "logGroupArnList", logGroupArnListField.Name)
			assert.Equal(t, "arn:aws:logs:us-east-1:1234567:log-group-1:id-1,arn:aws:logs:us-east-1:1234567:log-group-2:id-2", logGroupArnListField.At(0))
			assert.Equal(t, "arn:aws:logs:us-east-1:1234567:log-group-1:id-3,arn:aws:logs:us-east-1:1234567:log-group-2:id-4", logGroupArnListField.At(1))

			anomalyDetectorArnField := frame.Fields[9]
			assert.Equal(t, "anomalyArn", anomalyDetectorArnField.Name)
			assert.Equal(t, "arn:aws:logs:us-east-1:123456789012:anomaly-detector:anomaly-detector-1", anomalyDetectorArnField.At(0))
			assert.Equal(t, "arn:aws:logs:us-east-1:123456789012:anomaly-detector:anomaly-detector-2", anomalyDetectorArnField.At(1))

		}
	})

}

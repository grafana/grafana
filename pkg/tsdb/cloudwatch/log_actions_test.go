package cloudwatch

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestQuery_handleGetLogEvents_passes_nil_start_and_end_times_to_GetLogEvents(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient

	NewCWLogsClient = func(cfg aws.Config) models.CWLogsClient {
		return &cli
	}
	const refID = "A"

	testCases := map[string]struct {
		query         string
		expectedInput []*cloudwatchlogs.GetLogEventsInput
	}{
		"Nil startTime": {
			query: `{
				"type":         "logAction",
				"subtype":       "GetLogEvents",
				"logGroupName":  "foo",
				"logStreamName": "bar",
				"endTime":       1,
				"startFromHead": false
			}`,
			expectedInput: []*cloudwatchlogs.GetLogEventsInput{
				{
					EndTime:       aws.Int64(1),
					Limit:         aws.Int32(10),
					LogGroupName:  aws.String("foo"),
					LogStreamName: aws.String("bar"),
					StartFromHead: aws.Bool(false),
				},
			},
		},
		"Nil endTime": {
			query: `{
				"type":         "logAction",
				"subtype":       "GetLogEvents",
				"logGroupName":  "foo",
				"logStreamName": "bar",
				"startTime":       1,
				"startFromHead": true
			}`,
			expectedInput: []*cloudwatchlogs.GetLogEventsInput{
				{
					StartTime:     aws.Int64(1),
					Limit:         aws.Int32(10),
					LogGroupName:  aws.String("foo"),
					LogStreamName: aws.String("bar"),
					StartFromHead: aws.Bool(true),
				},
			},
		},
	}

	for name, test := range testCases {
		t.Run(name, func(t *testing.T) {
			cli = fakeCWLogsClient{}
			ds := newTestDatasource()
			_, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
				},
				Queries: []backend.DataQuery{
					{
						RefID:     refID,
						TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
						JSON:      json.RawMessage(test.query),
					},
				},
			})

			require.NoError(t, err)
			require.Len(t, cli.calls.getEvents, 1)
			assert.Equal(t, test.expectedInput, cli.calls.getEvents)
		})
	}
}

func TestQuery_GetLogEvents_returns_response_from_GetLogEvents_to_data_frame_field(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})
	var cli *mocks.MockLogEvents
	NewCWLogsClient = func(cfg aws.Config) models.CWLogsClient {
		return cli
	}
	ds := newTestDatasource()

	cli = &mocks.MockLogEvents{}
	cli.On("GetLogEvents", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatchlogs.GetLogEventsOutput{
		Events: []cloudwatchlogstypes.OutputLogEvent{{
			Message:   utils.Pointer("some message"),
			Timestamp: utils.Pointer(int64(15)),
		}}}, nil)

	resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		},
		Queries: []backend.DataQuery{
			{
				RefID:     "A",
				TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
				JSON: json.RawMessage(`{
							"type":         "logAction",
							"subtype":       "GetLogEvents",
							"logGroupName":  "foo",
							"logStreamName": "bar",
							"endTime":       1,
							"startFromHead": false
						}`),
			},
		},
	})

	require.NoError(t, err)

	respA, ok := resp.Responses["A"]
	assert.True(t, ok)

	expectedTsField := data.NewField("ts", nil, []time.Time{time.UnixMilli(15).UTC()})
	expectedMessageField := data.NewField("line", nil, []*string{utils.Pointer("some message")})
	expectedTsField.SetConfig(&data.FieldConfig{DisplayName: "Time"})
	assert.Equal(t, []*data.Field{expectedTsField, expectedMessageField}, respA.Frames[0].Fields)
}

func TestQuery_StartQuery(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient

	NewCWLogsClient = func(cfg aws.Config) models.CWLogsClient {
		return &cli
	}

	t.Run("invalid time range", func(t *testing.T) {
		const refID = "A"

		cli = fakeCWLogsClient{
			logGroupFields: cloudwatchlogs.GetLogGroupFieldsOutput{
				LogGroupFields: []cloudwatchlogstypes.LogGroupField{
					{
						Name:    aws.String("field_a"),
						Percent: 100,
					},
					{
						Name:    aws.String("field_b"),
						Percent: 30,
					},
					{
						Name:    aws.String("field_c"),
						Percent: 55,
					},
				},
			},
		}

		timeRange := backend.TimeRange{
			From: time.Unix(1584873443, 0),
			To:   time.Unix(1584700643, 0),
		}

		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.Region = "us-east-2"
		})
		resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     refID,
					TimeRange: timeRange,
					JSON: json.RawMessage(`{
						"type":        "logAction",
						"subtype":     "StartQuery",
						"limit":       50,
						"region":      "default",
						"queryString": "fields @message"
					}`),
				},
			},
		})
		require.NoError(t, err)

		assert.Equal(t, "failed to execute log action with subtype: StartQuery: invalid time range: start time must be before end time", resp.Responses[refID].Error.Error())
	})

	t.Run("valid time range", func(t *testing.T) {
		const refID = "A"
		cli = fakeCWLogsClient{
			logGroupFields: cloudwatchlogs.GetLogGroupFieldsOutput{
				LogGroupFields: []cloudwatchlogstypes.LogGroupField{
					{
						Name:    aws.String("field_a"),
						Percent: 100,
					},
					{
						Name:    aws.String("field_b"),
						Percent: 30,
					},
					{
						Name:    aws.String("field_c"),
						Percent: 55,
					},
				},
			},
		}

		timeRange := backend.TimeRange{
			From: time.Unix(1584700643000, 0),
			To:   time.Unix(1584873443000, 0),
		}

		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.Region = "us-east-2"
		})
		resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     refID,
					TimeRange: timeRange,
					JSON: json.RawMessage(`{
						"type":        "logAction",
						"subtype":     "StartQuery",
						"limit":       50,
						"region":      "default",
						"queryString": "fields @message"
					}`),
				},
			},
		})
		require.NoError(t, err)

		expFrame := data.NewFrame(
			refID,
			data.NewField("queryId", nil, []string{"abcd-efgh-ijkl-mnop"}),
		)
		expFrame.RefID = refID
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]any{
				"Region": "default",
			},
		}
		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			refID: {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})
}

func Test_executeStartQuery(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient

	NewCWLogsClient = func(cfg aws.Config) models.CWLogsClient {
		return &cli
	}

	t.Run("successfully parses information from JSON to StartQuery for language", func(t *testing.T) {
		testCases := map[string]struct {
			queries        []backend.DataQuery
			expectedOutput []*cloudwatchlogs.StartQueryInput
			queryLanguage  cloudwatchlogstypes.QueryLanguage
		}{
			"not defined": {
				queries: []backend.DataQuery{
					{
						RefID:     "A",
						TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
						JSON: json.RawMessage(`{
							"type":    "logAction",
							"subtype": "StartQuery",
							"limit":   12,
							"queryString":"fields @message",
							"logGroupNames":["some name","another name"]
						}`),
					},
				},
				expectedOutput: []*cloudwatchlogs.StartQueryInput{{
					StartTime:     aws.Int64(0),
					EndTime:       aws.Int64(1),
					Limit:         aws.Int32(12),
					QueryString:   aws.String("fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|fields @message"),
					LogGroupNames: []string{"some name", "another name"},
					QueryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
				}},
				queryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
			},
			"CWLI": {
				queries: []backend.DataQuery{{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"limit":   12,
						"queryLanguage": "CWLI",
						"queryString":"fields @message",
						"logGroupNames":["some name","another name"]
					}`),
				}},
				expectedOutput: []*cloudwatchlogs.StartQueryInput{
					{
						StartTime:     aws.Int64(0),
						EndTime:       aws.Int64(1),
						Limit:         aws.Int32(12),
						QueryString:   aws.String("fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|fields @message"),
						LogGroupNames: []string{"some name", "another name"},
						QueryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
					},
				},
				queryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
			},
			"PPL": {
				queries: []backend.DataQuery{{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"limit":   12,
						"queryLanguage": "PPL",
						"queryString":"source logs | fields @message",
						"logGroupNames":["some name","another name"]
					}`),
				}},
				expectedOutput: []*cloudwatchlogs.StartQueryInput{
					{
						StartTime:     aws.Int64(0),
						EndTime:       aws.Int64(1),
						Limit:         aws.Int32(12),
						QueryString:   aws.String("source logs | fields @message"),
						LogGroupNames: []string{"some name", "another name"},
						QueryLanguage: cloudwatchlogstypes.QueryLanguagePpl,
					},
				},
				queryLanguage: cloudwatchlogstypes.QueryLanguagePpl,
			},
			"SQL": {
				queries: []backend.DataQuery{
					{
						RefID:     "A",
						TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
						JSON: json.RawMessage(`{
							"type":    "logAction",
							"subtype": "StartQuery",
							"limit":   12,
							"queryLanguage": "SQL",
							"queryString":"SELECT * FROM logs",
							"logGroupNames":["some name","another name"]
						}`),
					},
				},
				expectedOutput: []*cloudwatchlogs.StartQueryInput{
					{
						StartTime:     aws.Int64(0),
						EndTime:       aws.Int64(1),
						Limit:         aws.Int32(12),
						QueryString:   aws.String("SELECT * FROM logs"),
						LogGroupNames: nil,
						QueryLanguage: cloudwatchlogstypes.QueryLanguageSql,
					},
				},
				queryLanguage: cloudwatchlogstypes.QueryLanguageSql,
			},
		}
		for name, test := range testCases {
			t.Run(name, func(t *testing.T) {
				cli = fakeCWLogsClient{}
				ds := newTestDatasource()
				_, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
					PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
					Queries:       test.queries,
				})

				assert.NoError(t, err)
				assert.Equal(t, test.expectedOutput, cli.calls.startQuery)
			})
		}
	})

	t.Run("does not populate StartQueryInput.limit when no limit provided", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource()

		_, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Nil(t, cli.calls.startQuery[0].Limit)
	})

	t.Run("attaches logGroupIdentifiers if the crossAccount feature is enabled", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource()

		_, err := ds.QueryData(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"limit":   12,
						"queryLanguage": "CWLI",
						"queryString":"fields @message",
						"logGroups":[{"arn": "fakeARN"}]
					}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, []*cloudwatchlogs.StartQueryInput{
			{
				StartTime:           aws.Int64(0),
				EndTime:             aws.Int64(1),
				Limit:               aws.Int32(12),
				QueryString:         aws.String("fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|fields @message"),
				LogGroupIdentifiers: []string{"fakeARN"},
				QueryLanguage:       cloudwatchlogstypes.QueryLanguageCwli,
			},
		}, cli.calls.startQuery)
	})

	t.Run("attaches logGroupIdentifiers if the crossAccount feature is enabled and strips out trailing *", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource()

		_, err := ds.QueryData(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"limit":   12,
						"queryString":"fields @message",
						"logGroups":[{"arn": "*fake**ARN*"}]
					}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, []*cloudwatchlogs.StartQueryInput{
			{
				StartTime:           aws.Int64(0),
				EndTime:             aws.Int64(1),
				Limit:               aws.Int32(12),
				QueryString:         aws.String("fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|fields @message"),
				LogGroupIdentifiers: []string{"*fake**ARN"},
				QueryLanguage:       cloudwatchlogstypes.QueryLanguageCwli,
			},
		}, cli.calls.startQuery)
	})

	t.Run("uses LogGroupNames if the cross account feature flag is not enabled, and log group names is present", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource()
		_, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"limit":   12,
						"queryString":"fields @message",
						"logGroups":[{"arn": "*fake**ARN*"}],
						"LogGroupNames": ["/log-group-name"]
					}`),
				},
			},
		})
		assert.NoError(t, err)
		assert.Equal(t, []*cloudwatchlogs.StartQueryInput{
			{
				StartTime:     aws.Int64(0),
				EndTime:       aws.Int64(1),
				Limit:         aws.Int32(12),
				QueryString:   aws.String("fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|fields @message"),
				LogGroupNames: []string{"/log-group-name"},
				QueryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
			},
		}, cli.calls.startQuery)
	})

	t.Run("ignores logGroups if feature flag is disabled even if logGroupNames is not present", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource()
		_, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"limit":   12,
						"queryString":"fields @message",
						"logGroups":[{"arn": "*fake**ARN*"}]
					}`),
				},
			},
		})
		assert.NoError(t, err)
		assert.Equal(t, []*cloudwatchlogs.StartQueryInput{
			{
				StartTime:     aws.Int64(0),
				EndTime:       aws.Int64(1),
				Limit:         aws.Int32(12),
				QueryString:   aws.String("fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|fields @message"),
				LogGroupNames: nil,
				QueryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
			},
		}, cli.calls.startQuery)
	})

	t.Run("it always uses logGroups when feature flag is enabled and ignores log group names", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource()
		_, err := ds.QueryData(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"limit":   12,
						"queryString":"fields @message",
						"logGroups":[{"arn": "*fake**ARN*"}],
						"logGroupNames":["/log-group"]
					}`),
				},
			},
		})
		assert.NoError(t, err)
		assert.Equal(t, []*cloudwatchlogs.StartQueryInput{
			{
				StartTime:           aws.Int64(0),
				EndTime:             aws.Int64(1),
				Limit:               aws.Int32(12),
				QueryString:         aws.String("fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|fields @message"),
				LogGroupIdentifiers: []string{"*fake**ARN"},
				QueryLanguage:       cloudwatchlogstypes.QueryLanguageCwli,
			},
		}, cli.calls.startQuery)
	})
}

func TestQuery_StopQuery(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient

	NewCWLogsClient = func(aws.Config) models.CWLogsClient {
		return &cli
	}

	cli = fakeCWLogsClient{
		logGroupFields: cloudwatchlogs.GetLogGroupFieldsOutput{
			LogGroupFields: []cloudwatchlogstypes.LogGroupField{
				{
					Name:    aws.String("field_a"),
					Percent: 100,
				},
				{
					Name:    aws.String("field_b"),
					Percent: 30,
				},
				{
					Name:    aws.String("field_c"),
					Percent: 55,
				},
			},
		},
	}

	timeRange := backend.TimeRange{
		From: time.Unix(1584873443, 0),
		To:   time.Unix(1584700643, 0),
	}

	ds := newTestDatasource()
	resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		},
		Queries: []backend.DataQuery{
			{
				TimeRange: timeRange,
				JSON: json.RawMessage(`{
					"type":    "logAction",
					"subtype": "StopQuery",
					"queryId": "abcd-efgh-ijkl-mnop"
				}`),
			},
		},
	})
	require.NoError(t, err)

	expFrame := &data.Frame{
		Name: "StopQueryResponse",
		Fields: []*data.Field{
			data.NewField("success", nil, []bool{true}),
		},
	}
	assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
		"": {
			Frames: data.Frames{expFrame},
		},
	},
	}, resp)
}

func TestQuery_GetQueryResults(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient

	NewCWLogsClient = func(aws.Config) models.CWLogsClient {
		return &cli
	}

	const refID = "A"
	cli = fakeCWLogsClient{
		queryResults: cloudwatchlogs.GetQueryResultsOutput{
			Results: [][]cloudwatchlogstypes.ResultField{
				{
					{
						Field: aws.String("@timestamp"),
						Value: aws.String("2020-03-20 10:37:23.000"),
					},
					{
						Field: aws.String("field_b"),
						Value: aws.String("b_1"),
					},
					{
						Field: aws.String("@ptr"),
						Value: aws.String("abcdefg"),
					},
				},
				{
					{
						Field: aws.String("@timestamp"),
						Value: aws.String("2020-03-20 10:40:43.000"),
					},
					{
						Field: aws.String("field_b"),
						Value: aws.String("b_2"),
					},
					{
						Field: aws.String("@ptr"),
						Value: aws.String("hijklmnop"),
					},
				},
			},
			Statistics: &cloudwatchlogstypes.QueryStatistics{
				BytesScanned:   512,
				RecordsMatched: 256,
				RecordsScanned: 1024,
			},
			Status: "Complete",
		},
	}

	ds := newTestDatasource()
	resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		},
		Queries: []backend.DataQuery{
			{
				RefID: refID,
				JSON: json.RawMessage(`{
					"type":    "logAction",
					"subtype": "GetQueryResults",
					"queryId": "abcd-efgh-ijkl-mnop"
				}`),
			},
		},
	})
	require.NoError(t, err)

	time1, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-20 10:37:23.000")
	require.NoError(t, err)
	time2, err := time.Parse("2006-01-02 15:04:05.000", "2020-03-20 10:40:43.000")
	require.NoError(t, err)
	expField1 := data.NewField("@timestamp", nil, []*time.Time{
		aws.Time(time1), aws.Time(time2),
	})
	expField1.SetConfig(&data.FieldConfig{DisplayName: "Time"})
	expField2 := data.NewField("field_b", nil, []*string{
		aws.String("b_1"), aws.String("b_2"),
	})
	expFrame := data.NewFrame(refID, expField1, expField2)
	expFrame.RefID = refID
	expFrame.Meta = &data.FrameMeta{
		Custom: map[string]any{
			"Status": "Complete",
		},
		Stats: []data.QueryStat{
			{
				FieldConfig: data.FieldConfig{DisplayName: "Bytes scanned"},
				Value:       512,
			},
			{
				FieldConfig: data.FieldConfig{DisplayName: "Records scanned"},
				Value:       1024,
			},
			{
				FieldConfig: data.FieldConfig{DisplayName: "Records matched"},
				Value:       256,
			},
		},
		PreferredVisualization: "logs",
	}

	assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
		refID: {
			Frames: data.Frames{expFrame},
		},
	},
	}, resp)
}

func TestGroupResponseFrame(t *testing.T) {
	t.Run("Doesn't group results without time field", func(t *testing.T) {
		frame := data.NewFrameOfFieldTypes("test", 0, data.FieldTypeString, data.FieldTypeInt32)
		frame.AppendRow("val1", int32(10))
		frame.AppendRow("val2", int32(20))
		frame.AppendRow("val3", int32(30))

		groupedFrame, err := groupResponseFrame(frame, []string{"something"})
		require.NoError(t, err)
		require.Equal(t, 3, groupedFrame[0].Rows())
		require.Equal(t, []any{"val1", "val2", "val3"}, asArray(groupedFrame[0].Fields[0]))
		require.Equal(t, []any{int32(10), int32(20), int32(30)}, asArray(groupedFrame[0].Fields[1]))
	})
}

func asArray(field *data.Field) []any {
	var vals []any
	for i := 0; i < field.Len(); i++ {
		vals = append(vals, field.At(i))
	}
	return vals
}

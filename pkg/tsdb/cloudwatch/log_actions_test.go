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
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
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
			"PPL with log scope does not drop log groups": {
				queries: []backend.DataQuery{{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"limit":   12,
						"queryLanguage": "PPL",
						"logsQueryScope": "namePrefix",
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
		ds := newTestDatasource(func(ds *DataSource) {
			ds.monitoringAccountCache.Store("us-east-1", true)
		})

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
						"logGroups":[{"arn": "fakeARN"}],
						"region": "us-east-1"
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
		ds := newTestDatasource(func(ds *DataSource) {
			ds.monitoringAccountCache.Store("us-east-1", true)
		})

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
						"region": "us-east-1"
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

	t.Run("skips empty log group identifiers after trimming", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource(func(ds *DataSource) {
			ds.monitoringAccountCache.Store("us-east-1", true)
		})

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
						"logGroups":[{"arn": "*"}],
						"region": "us-east-1"
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
				QueryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
			},
		}, cli.calls.startQuery)
	})

	t.Run("queries by LogGroupNames on StartQueryInput when queried region is not a monitoring account region for the data source", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource(func(ds *DataSource) {
			// note that the query's region is set to us-east-2, but the data source is only a monitoring account in us-east-1 so it should query by LogGroupNames
			ds.monitoringAccountCache.Store("us-east-1", true)
		})

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
						"logGroups":[{"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group","name":"/log-group"}],
						"region": "us-east-2"
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
				LogGroupNames: []string{"/log-group"},
				QueryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
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

	t.Run("deduplicates log group names when derived from logGroups", func(t *testing.T) {
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
						"logGroups":[
							{"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group1","name":"/log-group"},
							{"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group2","name":"/log-group"}
						]
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
				LogGroupNames: []string{"/log-group"},
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
				StartTime:     aws.Int64(0),
				EndTime:       aws.Int64(1),
				Limit:         aws.Int32(12),
				QueryString:   aws.String("fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|fields @message"),
				LogGroupNames: []string{"/log-group"},
				QueryLanguage: cloudwatchlogstypes.QueryLanguageCwli,
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

func Test_expandLogGroupsMacro(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient

	NewCWLogsClient = func(cfg aws.Config) models.CWLogsClient {
		return &cli
	}

	t.Run("expands $__logGroups macro with log group names when not a monitoring account", func(t *testing.T) {
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
						"queryLanguage": "SQL",
						"queryString":"SELECT * FROM ` + "`$__logGroups`" + `",
						"logGroups":[{"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group1", "name": "group1"}, {"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group2", "name": "group2"}]
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Equal(t, "SELECT * FROM `logGroups(logGroupIdentifier: ['group1', 'group2'])`", *cli.calls.startQuery[0].QueryString)
	})

	t.Run("expands $__logGroups macro with ARNs when monitoring account", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource(func(ds *DataSource) {
			ds.monitoringAccountCache.Store("us-east-1", true)
		})

		_, err := ds.QueryData(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"queryLanguage": "SQL",
						"queryString":"SELECT * FROM ` + "`$__logGroups`" + `",
						"logGroups":[{"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group1", "name": "group1"}, {"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group2", "name": "group2"}],
						"region": "us-east-1"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Equal(t, "SELECT * FROM `logGroups(logGroupIdentifier: ['arn:aws:logs:us-east-1:123456789012:log-group:group1', 'arn:aws:logs:us-east-1:123456789012:log-group:group2'])`", *cli.calls.startQuery[0].QueryString)
	})

	t.Run("strips trailing * from ARNs when expanding macro", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource(func(ds *DataSource) {
			ds.monitoringAccountCache.Store("us-east-1", true)
		})

		_, err := ds.QueryData(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"queryLanguage": "SQL",
						"queryString":"SELECT * FROM ` + "`$__logGroups`" + `",
						"logGroups":[{"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group1*", "name": "group1"}],
						"region": "us-east-1"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Equal(t, "SELECT * FROM `logGroups(logGroupIdentifier: ['arn:aws:logs:us-east-1:123456789012:log-group:group1'])`", *cli.calls.startQuery[0].QueryString)
	})

	t.Run("returns error when $__logGroups macro is used but no log groups are selected", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource()

		resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"queryLanguage": "SQL",
						"queryString":"SELECT * FROM ` + "`$__logGroups`" + `"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Contains(t, resp.Responses["A"].Error.Error(), "query contains $__logGroups but no log groups are selected")
	})

	t.Run("does not expand macro when query does not contain $__logGroups", func(t *testing.T) {
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
						"queryLanguage": "SQL",
						"queryString":"SELECT * FROM ` + "`logGroups(logGroupIdentifier: ['my-log-group'])`" + `"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Equal(t, "SELECT * FROM `logGroups(logGroupIdentifier: ['my-log-group'])`", *cli.calls.startQuery[0].QueryString)
	})

	t.Run("does not expand macro for non-SQL query languages", func(t *testing.T) {
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
						"queryLanguage": "CWLI",
						"queryString":"fields @message | $__logGroups",
						"logGroups":[{"arn": "arn:aws:logs:us-east-1:123456789012:log-group:group1", "name": "group1"}]
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Contains(t, *cli.calls.startQuery[0].QueryString, "$__logGroups")
	})

	t.Run("expands macro with single log group", func(t *testing.T) {
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
						"queryLanguage": "SQL",
						"queryString":"SELECT * FROM ` + "`$__logGroups`" + `",
						"logGroups":[{"arn": "arn:aws:logs:us-east-1:123456789012:log-group:single-group", "name": "single-group"}]
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Equal(t, "SELECT * FROM `logGroups(logGroupIdentifier: ['single-group'])`", *cli.calls.startQuery[0].QueryString)
	})
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

func TestContainsSourceCommand(t *testing.T) {
	testCases := map[string]struct {
		query    string
		expected bool
	}{
		"no SOURCE command": {
			query:    "fields @timestamp, @message | sort @timestamp desc | limit 25",
			expected: false,
		},
		"SOURCE at start": {
			query:    "SOURCE logGroups(namePrefix: ['app']) fields @timestamp, @message",
			expected: true,
		},
		"SOURCE lowercase": {
			query:    "source logGroups() fields @timestamp",
			expected: true,
		},
		"SOURCE mixed case": {
			query:    "Source logGroups() fields @timestamp",
			expected: true,
		},
		"SOURCE with leading whitespace": {
			query:    "   SOURCE logGroups() fields @timestamp",
			expected: true,
		},
		"SOURCE with newline after keyword": {
			query:    "SOURCE\nlogGroups() fields @timestamp",
			expected: true,
		},
		"SOURCE with tab after keyword": {
			query:    "SOURCE\tlogGroups() fields @timestamp",
			expected: true,
		},
		"SOURCE in middle of query (not at start)": {
			query:    "fields @timestamp | SOURCE something",
			expected: false,
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			result := containsSourceCommand(tc.query)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestBuildSourceClause(t *testing.T) {
	testCases := map[string]struct {
		logsQuery       models.LogsQuery
		includeAccounts bool
		expected        string
	}{
		"allLogGroups with no options": {
			logsQuery:       models.LogsQuery{},
			includeAccounts: false,
			expected:        "SOURCE logGroups()",
		},
		"namePrefix with single prefix": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					LogsQueryScope:   utils.Pointer(dataquery.LogsQueryScopeNamePrefix),
					LogGroupPrefixes: []string{"/aws/lambda"},
				},
			},
			includeAccounts: false,
			expected:        "SOURCE logGroups(namePrefix: ['/aws/lambda'])",
		},
		"namePrefix with multiple prefixes": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					LogsQueryScope:   utils.Pointer(dataquery.LogsQueryScopeNamePrefix),
					LogGroupPrefixes: []string{"/aws/lambda", "/aws/apigateway"},
				},
			},
			includeAccounts: false,
			expected:        "SOURCE logGroups(namePrefix: ['/aws/lambda', '/aws/apigateway'])",
		},
		"allLogGroups ignores leftover prefixes": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					LogsQueryScope:   utils.Pointer(dataquery.LogsQueryScopeAllLogGroups),
					LogGroupPrefixes: []string{"/aws/lambda"},
				},
			},
			includeAccounts: false,
			expected:        "SOURCE logGroups()",
		},
		"with INFREQUENT_ACCESS class": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					LogGroupClass: utils.Pointer(dataquery.LogGroupClassINFREQUENTACCESS),
				},
			},
			includeAccounts: false,
			expected:        "SOURCE logGroups(class: ['INFREQUENT_ACCESS'])",
		},
		"with STANDARD class (should be omitted)": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					LogGroupClass: utils.Pointer(dataquery.LogGroupClassSTANDARD),
				},
			},
			includeAccounts: false,
			expected:        "SOURCE logGroups()",
		},
		"with account identifiers when includeAccounts is true": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					SelectedAccountIds: []string{"123456789012", "987654321098"},
				},
			},
			includeAccounts: true,
			expected:        "SOURCE logGroups(accountIdentifier: ['123456789012', '987654321098'])",
		},
		"with account identifiers when includeAccounts is false (non-monitoring account)": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					SelectedAccountIds: []string{"123456789012", "987654321098"},
				},
			},
			includeAccounts: false,
			expected:        "SOURCE logGroups()",
		},
		"with all options and includeAccounts true": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					LogsQueryScope:     utils.Pointer(dataquery.LogsQueryScopeNamePrefix),
					LogGroupPrefixes:   []string{"/aws/lambda"},
					LogGroupClass:      utils.Pointer(dataquery.LogGroupClassINFREQUENTACCESS),
					SelectedAccountIds: []string{"123456789012"},
				},
			},
			includeAccounts: true,
			expected:        "SOURCE logGroups(namePrefix: ['/aws/lambda'], class: ['INFREQUENT_ACCESS'], accountIdentifier: ['123456789012'])",
		},
		"with all options but includeAccounts false": {
			logsQuery: models.LogsQuery{
				CloudWatchLogsQuery: dataquery.CloudWatchLogsQuery{
					LogsQueryScope:     utils.Pointer(dataquery.LogsQueryScopeNamePrefix),
					LogGroupPrefixes:   []string{"/aws/lambda"},
					LogGroupClass:      utils.Pointer(dataquery.LogGroupClassINFREQUENTACCESS),
					SelectedAccountIds: []string{"123456789012"},
				},
			},
			includeAccounts: false,
			expected:        "SOURCE logGroups(namePrefix: ['/aws/lambda'], class: ['INFREQUENT_ACCESS'])",
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			result := buildSourceClause(tc.logsQuery, tc.includeAccounts)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestValidateLogGroupPrefixes(t *testing.T) {
	testCases := map[string]struct {
		prefixes    []string
		expectError bool
		errorMsg    string
	}{
		"valid single prefix": {
			prefixes:    []string{"/aws/lambda"},
			expectError: false,
		},
		"valid multiple prefixes": {
			prefixes:    []string{"/aws/lambda", "/aws/ecs", "prod"},
			expectError: false,
		},
		"valid exactly 5 prefixes": {
			prefixes:    []string{"one", "two", "three", "four", "five"},
			expectError: false,
		},
		"empty prefixes": {
			prefixes:    []string{},
			expectError: true,
			errorMsg:    "at least one log group prefix is required",
		},
		"too many prefixes": {
			prefixes:    []string{"one", "two", "three", "four", "five", "six"},
			expectError: true,
			errorMsg:    "maximum of 5 log group prefixes allowed",
		},
		"prefix too short": {
			prefixes:    []string{"ab"},
			expectError: true,
			errorMsg:    "must be at least 3 characters",
		},
		"prefix contains wildcard": {
			prefixes:    []string{"/aws/*"},
			expectError: true,
			errorMsg:    "cannot contain wildcard character",
		},
		"one valid one invalid prefix": {
			prefixes:    []string{"/aws/lambda", "ab"},
			expectError: true,
			errorMsg:    "must be at least 3 characters",
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			err := validateLogGroupPrefixes(tc.prefixes)
			if tc.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.errorMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateAccountIdentifiers(t *testing.T) {
	testCases := map[string]struct {
		accounts    []string
		expectError bool
		errorMsg    string
	}{
		"valid empty accounts": {
			accounts:    []string{},
			expectError: false,
		},
		"valid single account": {
			accounts:    []string{"123456789012"},
			expectError: false,
		},
		"valid multiple accounts": {
			accounts:    []string{"123456789012", "234567890123", "345678901234"},
			expectError: false,
		},
		"valid exactly 20 accounts": {
			accounts: []string{
				"111111111111", "222222222222", "333333333333", "444444444444", "555555555555",
				"666666666666", "777777777777", "888888888888", "999999999999", "101010101010",
				"111111111112", "222222222223", "333333333334", "444444444445", "555555555556",
				"666666666667", "777777777778", "888888888889", "999999999990", "101010101011",
			},
			expectError: false,
		},
		"too many accounts": {
			accounts: []string{
				"111111111111", "222222222222", "333333333333", "444444444444", "555555555555",
				"666666666666", "777777777777", "888888888888", "999999999999", "101010101010",
				"111111111112", "222222222223", "333333333334", "444444444445", "555555555556",
				"666666666667", "777777777778", "888888888889", "999999999990", "101010101011",
				"121212121212",
			},
			expectError: true,
			errorMsg:    "maximum of 20 account identifiers allowed",
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			err := validateAccountIdentifiers(tc.accounts)
			if tc.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.errorMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestQuery_StartQuery_WithNamePrefixScope(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient
	NewCWLogsClient = func(cfg aws.Config) models.CWLogsClient {
		return &cli
	}

	t.Run("injects SOURCE clause for namePrefix scope", func(t *testing.T) {
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
						"queryLanguage": "CWLI",
						"queryString":"fields @message",
						"logsQueryScope": "namePrefix",
						"logGroupPrefixes": ["/aws/lambda"]
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Equal(t, "SOURCE logGroups(namePrefix: ['/aws/lambda']) | fields @timestamp,ltrim(@log) as "+logIdentifierInternal+",ltrim(@logStream) as "+logStreamIdentifierInternal+"|fields @message", *cli.calls.startQuery[0].QueryString)
	})

	t.Run("injects SOURCE clause for allLogGroups scope", func(t *testing.T) {
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
						"queryLanguage": "CWLI",
						"queryString":"fields @message",
						"logsQueryScope": "allLogGroups"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Equal(t, "SOURCE logGroups() | fields @timestamp,ltrim(@log) as "+logIdentifierInternal+",ltrim(@logStream) as "+logStreamIdentifierInternal+"|fields @message", *cli.calls.startQuery[0].QueryString)
	})

	t.Run("returns error when query already contains SOURCE command", func(t *testing.T) {
		cli = fakeCWLogsClient{}
		ds := newTestDatasource()

		resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"type":    "logAction",
						"subtype": "StartQuery",
						"queryLanguage": "CWLI",
						"queryString":"SOURCE logGroups() fields @message",
						"logsQueryScope": "namePrefix",
						"logGroupPrefixes": ["/aws/lambda"]
					}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Contains(t, resp.Responses["A"].Error.Error(), "query cannot contain SOURCE command when using Name prefix or All log groups mode")
	})

	t.Run("does not inject SOURCE clause for logGroupName scope", func(t *testing.T) {
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
						"queryLanguage": "CWLI",
						"queryString":"fields @message",
						"logsQueryScope": "logGroupName",
						"logGroupNames": ["/aws/lambda/myfunction"]
					}`),
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, cli.calls.startQuery, 1)
		assert.Equal(t, "fields @timestamp,ltrim(@log) as "+logIdentifierInternal+",ltrim(@logStream) as "+logStreamIdentifierInternal+"|fields @message", *cli.calls.startQuery[0].QueryString)
	})
}

func TestFormatStringArrayForSource(t *testing.T) {
	testCases := map[string]struct {
		input    []string
		expected string
	}{
		"single element": {
			input:    []string{"value1"},
			expected: "['value1']",
		},
		"multiple elements": {
			input:    []string{"value1", "value2", "value3"},
			expected: "['value1', 'value2', 'value3']",
		},
		"empty array": {
			input:    []string{},
			expected: "[]",
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			result := formatStringArrayForSource(tc.input)
			assert.Equal(t, tc.expected, result)
		})
	}
}

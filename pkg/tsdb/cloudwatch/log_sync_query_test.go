package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func Test_executeSyncLogQuery(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var cli fakeCWLogsClient
	NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
		return &cli
	}

	t.Run("getCWLogsClient is called with region from input JSON", func(t *testing.T) {
		cli = fakeCWLogsClient{queryResults: cloudwatchlogs.GetQueryResultsOutput{Status: aws.String("Complete")}}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		sess := fakeSessionCache{}
		executor := newExecutor(im, newTestConfig(), &sess, featuremgmt.WithFeatures())

		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			Headers:       map[string]string{ngalertmodels.FromAlertHeaderName: "some value"},
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs",
						"region": "some region"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, []string{"some region"}, sess.calledRegions)
	})

	t.Run("getCWLogsClient is called with region from instance manager when region is default", func(t *testing.T) {
		cli = fakeCWLogsClient{queryResults: cloudwatchlogs.GetQueryResultsOutput{Status: aws.String("Complete")}}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{AWSDatasourceSettings: awsds.AWSDatasourceSettings{Region: "instance manager's region"}}}, nil
		})
		sess := fakeSessionCache{}

		executor := newExecutor(im, newTestConfig(), &sess, featuremgmt.WithFeatures())
		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			Headers:       map[string]string{ngalertmodels.FromAlertHeaderName: "some value"},
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs",
						"region": "default"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, []string{"instance manager's region"}, sess.calledRegions)
	})

	t.Run("with header", func(t *testing.T) {
		testcases := []struct {
			name    string
			headers map[string]string
			called  bool
		}{
			{
				"alert header",
				map[string]string{ngalertmodels.FromAlertHeaderName: "some value"},
				true,
			},
			{
				"expression header",
				map[string]string{fmt.Sprintf("http_%s", query.HeaderFromExpression): "some value"},
				true,
			},
			{
				"no header",
				map[string]string{},
				false,
			},
		}
		origExecuteSyncLogQuery := executeSyncLogQuery
		var syncCalled bool
		executeSyncLogQuery = func(ctx context.Context, e *cloudWatchExecutor, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			syncCalled = true
			return nil, nil
		}

		for _, tc := range testcases {
			t.Run(tc.name, func(t *testing.T) {
				syncCalled = false
				cli = fakeCWLogsClient{queryResults: cloudwatchlogs.GetQueryResultsOutput{Status: aws.String("Complete")}}
				im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
					return DataSource{Settings: models.CloudWatchSettings{AWSDatasourceSettings: awsds.AWSDatasourceSettings{Region: "instance manager's region"}}}, nil
				})
				sess := fakeSessionCache{}

				executor := newExecutor(im, newTestConfig(), &sess, featuremgmt.WithFeatures())
				_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
					Headers:       tc.headers,
					PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
					Queries: []backend.DataQuery{
						{
							TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
							JSON: json.RawMessage(`{
								"queryMode":    "Logs",
								"type":        "logAction",
								"subtype":     "StartQuery",
								"region":      "default",
								"queryString": "fields @message"
							}`),
						},
					},
				})

				assert.NoError(t, err)
				assert.Equal(t, tc.called, syncCalled)
			})
		}

		executeSyncLogQuery = origExecuteSyncLogQuery
	})
}
func Test_executeSyncLogQuery_handles_RefId_from_input_queries(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var cli *mockLogsSyncClient
	NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
		return cli
	}

	t.Run("when a query refId is not provided, 'A' is assigned by default", func(t *testing.T) {
		cli = &mockLogsSyncClient{}
		cli.On("StartQueryWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatchlogs.StartQueryOutput{
			QueryId: aws.String("abcd-efgh-ijkl-mnop"),
		}, nil)
		cli.On("GetQueryResultsWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatchlogs.GetQueryResultsOutput{Status: aws.String("Complete")}, nil)
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		res, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			Headers:       map[string]string{ngalertmodels.FromAlertHeaderName: "some value"},
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		_, ok := res.Responses["A"]
		assert.True(t, ok)
	})

	t.Run("when a query refId is provided, it is returned in the response", func(t *testing.T) {
		cli = &mockLogsSyncClient{}
		cli.On("StartQueryWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatchlogs.StartQueryOutput{
			QueryId: aws.String("abcd-efgh-ijkl-mnop"),
		}, nil)
		cli.On("GetQueryResultsWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatchlogs.GetQueryResultsOutput{Status: aws.String("Complete")}, nil)
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		res, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			Headers:       map[string]string{ngalertmodels.FromAlertHeaderName: "some value"},
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs"
					}`),
				},
				{
					RefID:     "B",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		_, ok := res.Responses["A"]
		assert.True(t, ok)
		_, ok = res.Responses["B"]
		assert.True(t, ok)
	})

	t.Run("when RefIDs are provided, correctly pass them on with the results", func(t *testing.T) {
		// This test demonstrates that given two queries with different RefIds,
		// when each query has a different response from AWS API calls, the RefIds are correctly reassigned to the associated response.
		cli = &mockLogsSyncClient{}
		// mock.MatchedBy makes sure that the QueryId below will only be returned when the input expression = "query string for A"
		cli.On("StartQueryWithContext", mock.Anything, mock.MatchedBy(func(input *cloudwatchlogs.StartQueryInput) bool {
			return *input.QueryString == "fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|query string for A"
		}), mock.Anything).Return(&cloudwatchlogs.StartQueryOutput{
			QueryId: aws.String("queryId for A"),
		}, nil)

		// mock.MatchedBy makes sure that the QueryId below will only be returned when the input expression = "query string for B"
		cli.On("StartQueryWithContext", mock.Anything, mock.MatchedBy(func(input *cloudwatchlogs.StartQueryInput) bool {
			return *input.QueryString == "fields @timestamp,ltrim(@log) as __log__grafana_internal__,ltrim(@logStream) as __logstream__grafana_internal__|query string for B"
		}), mock.Anything).Return(&cloudwatchlogs.StartQueryOutput{
			QueryId: aws.String("queryId for B"),
		}, nil)
		cli.On("GetQueryResultsWithContext", mock.Anything, mock.MatchedBy(func(input *cloudwatchlogs.GetQueryResultsInput) bool {
			return *input.QueryId == "queryId for A"
		}), mock.Anything).Return(&cloudwatchlogs.GetQueryResultsOutput{
			// this result will only be returned when the argument is QueryId = "queryId for A"
			Results: [][]*cloudwatchlogs.ResultField{{{
				Field: utils.Pointer("@log"),
				Value: utils.Pointer("A result"),
			}}},
			Status: aws.String("Complete")}, nil)
		cli.On("GetQueryResultsWithContext", mock.Anything, mock.MatchedBy(func(input *cloudwatchlogs.GetQueryResultsInput) bool {
			return *input.QueryId == "queryId for B"
		}), mock.Anything).Return(&cloudwatchlogs.GetQueryResultsOutput{
			// this result will only be returned when the argument is QueryId = "queryId for B"
			Results: [][]*cloudwatchlogs.ResultField{{{
				Field: utils.Pointer("@log"),
				Value: utils.Pointer("B result"),
			}}},
			Status: aws.String("Complete")}, nil)

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		res, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			Headers:       map[string]string{ngalertmodels.FromAlertHeaderName: "some value"},
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs",
						"expression": "query string for A"
					}`),
				},
				{
					RefID:     "B",
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs",
						"expression": "query string for B"
					}`),
				},
			},
		})

		expectedLogFieldFromFirstCall := data.NewField("@log", nil, []*string{utils.Pointer("A result")}) // verifies the response from GetQueryResultsWithContext matches the input RefId A
		assert.NoError(t, err)
		respA, ok := res.Responses["A"]
		require.True(t, ok)
		assert.Equal(t, []*data.Field{expectedLogFieldFromFirstCall}, respA.Frames[0].Fields)

		expectedLogFieldFromSecondCall := data.NewField("@log", nil, []*string{utils.Pointer("B result")}) // verifies the response from GetQueryResultsWithContext matches the input RefId B
		respB, ok := res.Responses["B"]
		require.True(t, ok)
		assert.Equal(t, []*data.Field{expectedLogFieldFromSecondCall}, respB.Frames[0].Fields)
	})
}

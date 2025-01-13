package cloudwatch

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimeSeriesQuery(t *testing.T) {
	executor := newExecutor(defaultTestInstanceManager(), log.NewNullLogger())
	now := time.Now()

	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})
	var api mocks.MetricsAPI

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &api
	}

	t.Run("Custom metrics", func(t *testing.T) {
		api = mocks.MetricsAPI{}
		api.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatch.GetMetricDataOutput{
			MetricDataResults: []*cloudwatch.MetricDataResult{
				{
					StatusCode: aws.String("Complete"), Id: aws.String("a"), Label: aws.String("NetworkOut"), Values: []*float64{aws.Float64(1.0)}, Timestamps: []*time.Time{&now},
				},
				{
					StatusCode: aws.String("Complete"), Id: aws.String("b"), Label: aws.String("NetworkIn"), Values: []*float64{aws.Float64(1.0)}, Timestamps: []*time.Time{&now},
				}}}, nil)

		im := defaultTestInstanceManager()

		executor := newExecutor(im, log.NewNullLogger())
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: now.Add(time.Hour * -2),
						To:   now.Add(time.Hour * -1),
					},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"subtype":   "metrics",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"expression": "",
						"dimensions": {
						  "InstanceId": "i-00645d91ed77d87ac"
						},
						"region": "us-east-2",
						"id": "a",
						"statistics": [
						  "Maximum"
						],
						"period": "300",
						"hide": false,
						"matchExact": true,
						"refId": "A"
					}`),
				},
				{
					RefID: "B",
					TimeRange: backend.TimeRange{
						From: now.Add(time.Hour * -2),
						To:   now.Add(time.Hour * -1),
					},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"subtype":   "metrics",
						"namespace": "AWS/EC2",
						"metricName": "NetworkIn",
						"expression": "",
						"dimensions": {
						"InstanceId": "i-00645d91ed77d87ac"
						},
						"region": "us-east-2",
						"id": "b",
						"statistics": [
						"Maximum"
						],
						"period": "300",
						"matchExact": true,
						"refId": "B"
					}`),
				},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, "NetworkOut", resp.Responses["A"].Frames[0].Name)
		assert.Equal(t, "NetworkIn", resp.Responses["B"].Frames[0].Name)
	})

	t.Run("End time before start time should result in error", func(t *testing.T) {
		_, err := executor.executeTimeSeriesQuery(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{{TimeRange: backend.TimeRange{
				From: now.Add(time.Hour * -1),
				To:   now.Add(time.Hour * -2),
			}}}})
		assert.EqualError(t, err, "invalid time range: start time must be before end time")
	})

	t.Run("End time equals start time should result in error", func(t *testing.T) {
		_, err := executor.executeTimeSeriesQuery(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{{TimeRange: backend.TimeRange{
				From: now.Add(time.Hour * -1),
				To:   now.Add(time.Hour * -1),
			}}}})
		assert.EqualError(t, err, "invalid time range: start time must be before end time")
	})
}

func Test_executeTimeSeriesQuery_getCWClient_is_called_once_per_region_and_GetMetricData_is_called_once_per_grouping_of_queries_by_region(t *testing.T) {
	/* TODO: This test aims to verify the logic to group regions which has been extracted from ParseMetricDataQueries.
	It should be replaced by a test at a lower level when grouping by regions is incorporated into a separate business logic layer */
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var mockMetricClient mocks.MetricsAPI
	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &mockMetricClient
	}

	t.Run("Queries with the same region should call GetSessionWithAuthSettings with that region 1 time and call GetMetricDataWithContext 1 time", func(t *testing.T) {
		mockSessionCache := &mockSessionCache{}
		mockSessionCache.On("GetSessionWithAuthSettings", mock.MatchedBy(
			func(config awsds.GetSessionConfig) bool {
				return config.Settings.Region == "us-east-1"
			})). // region from queries is asserted here
			Return(&session.Session{Config: &aws.Config{}}, nil).Once()
		im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}, sessions: mockSessionCache}, nil
		})
		mockMetricClient = mocks.MetricsAPI{}
		mockMetricClient.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)

		executor := newExecutor(im, log.NewNullLogger())
		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"region": "us-east-1",
						"statistic": "Maximum",
						"period": "300"
					}`),
				},
				{
					RefID:     "B",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"namespace": "AWS/EC2",
						"metricName": "NetworkIn",
						"region": "us-east-1",
						"statistic": "Maximum",
						"period": "300"
					}`),
				},
			},
		})

		require.NoError(t, err)
		mockSessionCache.AssertExpectations(t) // method is defined to only return "Once()",
		// AssertExpectations will fail if those methods were not called Once(), so expected number of calls is asserted by this line
		mockMetricClient.AssertNumberOfCalls(t, "GetMetricDataWithContext", 1)
		// GetMetricData is asserted to have been called 1 time for the 1 region present in the queries
	})

	t.Run("3 queries with 2 regions calls GetSessionWithAuthSettings 2 times and calls GetMetricDataWithContext 2 times", func(t *testing.T) {
		sessionCache := &mockSessionCache{}
		sessionCache.On("GetSessionWithAuthSettings", mock.MatchedBy(
			func(config awsds.GetSessionConfig) bool {
				return config.Settings.Region == "us-east-1"
			})).
			Return(&session.Session{Config: &aws.Config{}}, nil).Once()
		sessionCache.On("GetSessionWithAuthSettings", mock.MatchedBy(
			func(config awsds.GetSessionConfig) bool {
				return config.Settings.Region == "us-east-2"
			})).
			Return(&session.Session{Config: &aws.Config{}}, nil).Once()

		im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}, sessions: sessionCache}, nil
		})

		mockMetricClient = mocks.MetricsAPI{}
		mockMetricClient.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)

		executor := newExecutor(im, log.NewNullLogger())
		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"region": "us-east-2",
						"statistic": "Maximum",
						"period": "300"
					}`),
				},
				{
					RefID:     "A2",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"region": "us-east-2",
						"statistic": "Maximum",
						"period": "300"
					}`),
				},
				{
					RefID:     "B",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"namespace": "AWS/EC2",
						"metricName": "NetworkIn",
						"region": "us-east-1",
						"statistic": "Maximum",
						"period": "300"
					}`),
				},
			},
		})

		require.NoError(t, err)
		sessionCache.AssertExpectations(t) // method is defined to only return "Once()" for each region.
		// AssertExpectations will fail if those methods were not called Once(), so expected number of calls is asserted by this line
		mockMetricClient.AssertNumberOfCalls(t, "GetMetricDataWithContext", 2)
		// GetMetricData is asserted to have been called 2 times, presumably once for each group of regions (2 regions total)
	})

	t.Run("3 queries with 2 time ranges calls GetSessionWithAuthSettings 2 times and calls GetMetricDataWithContext 2 times", func(t *testing.T) {
		sessionCache := &mockSessionCache{}
		sessionCache.On("GetSessionWithAuthSettings", mock.MatchedBy(
			func(config awsds.GetSessionConfig) bool {
				return config.Settings.Region == "us-east-2"
			})).
			Return(&session.Session{Config: &aws.Config{}}, nil).Times(2)

		im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}, sessions: sessionCache}, nil
		})

		mockMetricClient = mocks.MetricsAPI{}
		mockMetricClient.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)

		executor := newExecutor(im, log.NewNullLogger())
		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now()},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"region": "us-east-2",
						"statistic": "Maximum",
						"period": "300"
					}`),
				},
				{
					RefID:     "A2",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now()},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"region": "us-east-2",
						"statistic": "Maximum",
						"period": "300"
					}`),
				},
				{
					RefID:     "B",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"namespace": "AWS/EC2",
						"metricName": "NetworkIn",
						"region": "us-east-2",
						"statistic": "Maximum",
						"period": "300"
					}`),
				},
			},
		})

		require.NoError(t, err)
		sessionCache.AssertExpectations(t) // method is defined to return twice (once for each batch)
		mockMetricClient.AssertNumberOfCalls(t, "GetMetricDataWithContext", 2)
		// GetMetricData is asserted to have been called 2 times, presumably once for each time range (2 time ranges total)
	})
}

type queryDimensions struct {
	InstanceID []string `json:"InstanceId,omitempty"`
}

type queryParameters struct {
	MetricQueryType  dataquery.MetricQueryType  `json:"metricQueryType"`
	MetricEditorMode dataquery.MetricEditorMode `json:"metricEditorMode"`
	Dimensions       queryDimensions            `json:"dimensions"`
	Expression       string                     `json:"expression"`
	Label            *string                    `json:"label"`
	Statistic        string                     `json:"statistic"`
	Period           string                     `json:"period"`
	MatchExact       bool                       `json:"matchExact"`
	MetricName       string                     `json:"metricName"`
}

var queryId = "query id"

func newTestQuery(t testing.TB, p queryParameters) json.RawMessage {
	t.Helper()

	tsq := struct {
		Type             string                     `json:"type"`
		MetricQueryType  dataquery.MetricQueryType  `json:"metricQueryType"`
		MetricEditorMode dataquery.MetricEditorMode `json:"metricEditorMode"`
		Namespace        string                     `json:"namespace"`
		MetricName       string                     `json:"metricName"`
		Dimensions       struct {
			InstanceID []string `json:"InstanceId,omitempty"`
		} `json:"dimensions"`
		Expression string  `json:"expression"`
		Region     string  `json:"region"`
		ID         string  `json:"id"`
		Label      *string `json:"label"`
		Statistic  string  `json:"statistic"`
		Period     string  `json:"period"`
		MatchExact bool    `json:"matchExact"`
		RefID      string  `json:"refId"`
	}{
		Type:   "timeSeriesQuery",
		Region: "us-east-2",
		ID:     queryId,
		RefID:  "A",

		MatchExact:       p.MatchExact,
		MetricQueryType:  p.MetricQueryType,
		MetricEditorMode: p.MetricEditorMode,
		Dimensions:       p.Dimensions,
		Expression:       p.Expression,
		Label:            p.Label,
		Statistic:        p.Statistic,
		Period:           p.Period,
		MetricName:       p.MetricName,
	}

	marshalled, err := json.Marshal(tsq)
	require.NoError(t, err)

	return marshalled
}

func Test_QueryData_timeSeriesQuery_GetMetricDataWithContext(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var api mocks.MetricsAPI

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &api
	}

	im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return DataSource{Settings: models.CloudWatchSettings{}, sessions: &fakeSessionCache{}}, nil
	})

	t.Run("passes query label as GetMetricData label", func(t *testing.T) {
		api = mocks.MetricsAPI{}
		api.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatch.GetMetricDataOutput{}, nil)
		executor := newExecutor(im, log.NewNullLogger())
		query := newTestQuery(t, queryParameters{
			Label: aws.String("${PROP('Period')} some words ${PROP('Dim.InstanceId')}"),
		})

		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Now().Add(time.Hour * -2),
						To:   time.Now().Add(time.Hour * -1),
					},
					JSON: query,
				},
			},
		})

		assert.NoError(t, err)
		require.Len(t, api.Calls, 1)
		getMetricDataInput, ok := api.Calls[0].Arguments.Get(1).(*cloudwatch.GetMetricDataInput)
		require.True(t, ok)
		require.Len(t, getMetricDataInput.MetricDataQueries, 1)
		require.NotNil(t, getMetricDataInput.MetricDataQueries[0].Label)
		assert.Equal(t, "${PROP('Period')} some words ${PROP('Dim.InstanceId')}", *getMetricDataInput.MetricDataQueries[0].Label)
	})

	testCases := map[string]struct {
		parameters queryParameters
	}{
		"should not pass GetMetricData label when query label is empty":        {},
		"should not pass GetMetricData label when query label is empty string": {parameters: queryParameters{Label: aws.String("")}},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			api = mocks.MetricsAPI{}
			api.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatch.GetMetricDataOutput{}, nil)
			executor := newExecutor(im, log.NewNullLogger())

			_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
				Queries: []backend.DataQuery{
					{
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: time.Now().Add(time.Hour * -2),
							To:   time.Now().Add(time.Hour * -1),
						},
						JSON: newTestQuery(t, tc.parameters),
					},
				},
			})

			assert.NoError(t, err)
			assert.NoError(t, err)
			require.Len(t, api.Calls, 1)
			getMetricDataInput, ok := api.Calls[0].Arguments.Get(1).(*cloudwatch.GetMetricDataInput)
			require.True(t, ok)
			require.Len(t, getMetricDataInput.MetricDataQueries, 1)
			require.Nil(t, getMetricDataInput.MetricDataQueries[0].Label)
		})
	}
}

func Test_QueryData_response_data_frame_name_is_always_response_label(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	api := mocks.MetricsAPI{Metrics: []*cloudwatch.Metric{
		{MetricName: aws.String(""), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("InstanceId"), Value: aws.String("i-00645d91ed77d87ac")}}},
	}}
	api.On("ListMetricsPagesWithContext").Return(nil)

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &api
	}

	labelFromGetMetricData := "some label"
	api.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).
		Return(&cloudwatch.GetMetricDataOutput{
			MetricDataResults: []*cloudwatch.MetricDataResult{
				{StatusCode: aws.String("Complete"), Id: aws.String(queryId), Label: aws.String(labelFromGetMetricData),
					Values: []*float64{aws.Float64(1.0)}, Timestamps: []*time.Time{{}}},
			}}, nil)

	im := defaultTestInstanceManager()
	executor := newExecutor(im, log.NewNullLogger())

	t.Run("where user defines search expression", func(t *testing.T) {
		query := newTestQuery(t, queryParameters{
			MetricQueryType:  models.MetricQueryTypeSearch,                                                 // contributes to isUserDefinedSearchExpression = true
			MetricEditorMode: models.MetricEditorModeRaw,                                                   // contributes to isUserDefinedSearchExpression = true
			Expression:       `SEARCH('{AWS/EC2,InstanceId} MetricName="CPUUtilization"', 'Average', 300)`, // period 300 and stat 'Average' parsed from this expression
			Statistic:        "Maximum",                                                                    // stat parsed from expression takes precedence over 'Maximum'
			Period:           "1200",                                                                       // period parsed from expression takes precedence over 1200
		})

		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON:      query,
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, labelFromGetMetricData, resp.Responses["A"].Frames[0].Name)
	})

	t.Run("where query is math expression", func(t *testing.T) {
		query := newTestQuery(t, queryParameters{
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeRaw,
		})

		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON:      query,
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, labelFromGetMetricData, resp.Responses["A"].Frames[0].Name)
	})

	t.Run("where query type is MetricQueryTypeQuery", func(t *testing.T) {
		query := newTestQuery(t, queryParameters{
			MetricQueryType: models.MetricQueryTypeQuery,
		})

		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON:      query,
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, labelFromGetMetricData, resp.Responses["A"].Frames[0].Name)
	})

	// where query is inferred search expression and not multivalued dimension expression
	testCasesReturningLabel := map[string]queryParameters{
		"with specific dimensions, matchExact false": {Dimensions: queryDimensions{[]string{"some-instance"}}, MatchExact: false},
		"with wildcard dimensions, matchExact false": {Dimensions: queryDimensions{[]string{"*"}}, MatchExact: false},
		"with wildcard dimensions, matchExact true":  {Dimensions: queryDimensions{[]string{"*"}}, MatchExact: true},
		"no dimension, matchExact false":             {Dimensions: queryDimensions{}, MatchExact: false},
	}
	for name, parameters := range testCasesReturningLabel {
		t.Run(name, func(t *testing.T) {
			query := newTestQuery(t, parameters)

			resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
				Queries: []backend.DataQuery{
					{
						RefID:     "A",
						TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
						JSON:      query,
					},
				},
			})

			assert.NoError(t, err)
			assert.Equal(t, labelFromGetMetricData, resp.Responses["A"].Frames[0].Name)
		})
	}

	// complementary test cases to above
	testCasesReturningMetricStat := map[string]queryParameters{
		"with specific dimensions, matchExact true": {
			Dimensions: queryDimensions{[]string{"some-instance"}},
			MatchExact: true,
			MetricName: "CPUUtilization",
			Statistic:  "Maximum",
		},
		"no dimensions, matchExact true": {
			Dimensions: queryDimensions{},
			MatchExact: true,
			MetricName: "CPUUtilization",
			Statistic:  "Maximum",
		},
		"multivalued dimensions, matchExact true": {
			Dimensions: queryDimensions{[]string{"some-instance", "another-instance"}},
			MatchExact: true,
			MetricName: "CPUUtilization",
			Statistic:  "Maximum",
		},
		"multivalued dimensions, matchExact false": {
			Dimensions: queryDimensions{[]string{"some-instance", "another-instance"}},
			MatchExact: false,
			MetricName: "CPUUtilization",
			Statistic:  "Maximum",
		},
	}
	for name, parameters := range testCasesReturningMetricStat {
		t.Run(name, func(t *testing.T) {
			query := newTestQuery(t, parameters)

			resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
				Queries: []backend.DataQuery{
					{
						RefID:     "A",
						TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
						JSON:      query,
					},
				},
			})

			assert.NoError(t, err)
			assert.Equal(t, labelFromGetMetricData, resp.Responses["A"].Frames[0].Name)
		})
	}
}

func TestTimeSeriesQuery_CrossAccountQuerying(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})
	var api mocks.MetricsAPI

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &api
	}
	im := defaultTestInstanceManager()

	t.Run("should call GetMetricDataInput with AccountId nil when no AccountId is provided", func(t *testing.T) {
		api = mocks.MetricsAPI{}
		api.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatch.GetMetricDataOutput{}, nil)
		executor := newExecutor(im, log.NewNullLogger())

		_, err := executor.QueryData(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"subtype":   "metrics",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"dimensions": {
						  "InstanceId": "i-00645d91ed77d87ac"
						},
						"region": "us-east-2",
						"id": "a",
						"statistic": "Maximum",
						"period": "300",
						"hide": false,
						"matchExact": true,
						"refId": "A"
					}`),
				},
			},
		})
		require.NoError(t, err)
		actualInput, ok := api.Calls[0].Arguments[1].(*cloudwatch.GetMetricDataInput)
		require.True(t, ok)
		require.Len(t, actualInput.MetricDataQueries, 1)

		assert.Nil(t, actualInput.MetricDataQueries[0].Expression)
		assert.Nil(t, actualInput.MetricDataQueries[0].AccountId)
	})

	t.Run("should call GetMetricDataInput with AccountId nil when feature flag is false", func(t *testing.T) {
		api = mocks.MetricsAPI{}
		api.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatch.GetMetricDataOutput{}, nil)
		executor := newExecutor(im, log.NewNullLogger())
		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"subtype":   "metrics",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"dimensions": {
						  "InstanceId": "i-00645d91ed77d87ac"
						},
						"region": "us-east-2",
						"id": "a",
						"statistic": "Maximum",
						"period": "300",
						"hide": false,
						"matchExact": true,
						"refId": "A",
						"accountId":"some account Id"
					}`),
				},
			},
		})
		require.NoError(t, err)
		actualInput, ok := api.Calls[0].Arguments[1].(*cloudwatch.GetMetricDataInput)
		require.True(t, ok)
		require.Len(t, actualInput.MetricDataQueries, 1)

		assert.Nil(t, actualInput.MetricDataQueries[0].Expression)
		assert.Nil(t, actualInput.MetricDataQueries[0].AccountId)
	})

	t.Run("should call GetMetricDataInput with AccountId in a MetricStat query", func(t *testing.T) {
		api = mocks.MetricsAPI{}
		api.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatch.GetMetricDataOutput{}, nil)
		executor := newExecutor(im, log.NewNullLogger())
		_, err := executor.QueryData(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"subtype":   "metrics",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"dimensions": {
						  "InstanceId": "i-00645d91ed77d87ac"
						},
						"region": "us-east-2",
						"id": "a",
						"statistic": "Maximum",
						"period": "300",
						"hide": false,
						"matchExact": true,
						"refId": "A",
						"accountId":"some account Id"
					}`),
				},
			},
		})
		require.NoError(t, err)
		actualInput, ok := api.Calls[0].Arguments[1].(*cloudwatch.GetMetricDataInput)
		require.True(t, ok)
		require.Len(t, actualInput.MetricDataQueries, 1)

		require.NotNil(t, actualInput.MetricDataQueries[0].AccountId)
		assert.Equal(t, "some account Id", *actualInput.MetricDataQueries[0].AccountId)
	})

	t.Run("should GetMetricDataInput with AccountId in an inferred search expression query", func(t *testing.T) {
		api = mocks.MetricsAPI{}
		api.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(&cloudwatch.GetMetricDataOutput{}, nil)
		executor := newExecutor(im, log.NewNullLogger())
		_, err := executor.QueryData(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					TimeRange: backend.TimeRange{From: time.Now().Add(time.Hour * -2), To: time.Now().Add(time.Hour * -1)},
					JSON: json.RawMessage(`{
						"type":      "timeSeriesQuery",
						"subtype":   "metrics",
						"namespace": "AWS/EC2",
						"metricName": "NetworkOut",
						"dimensions": {
						  "InstanceId": "*"
						},
						"region": "us-east-2",
						"id": "a",
						"statistic": "Maximum",
						"period": "300",
						"hide": false,
						"matchExact": true,
						"refId": "A",
						"accountId":"some account Id"
					}`),
				},
			},
		})
		require.NoError(t, err)
		actualInput, ok := api.Calls[0].Arguments[1].(*cloudwatch.GetMetricDataInput)
		require.True(t, ok)
		require.Len(t, actualInput.MetricDataQueries, 1)

		require.NotNil(t, actualInput.MetricDataQueries[0].Expression)
		assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","InstanceId"} MetricName="NetworkOut" :aws.AccountId="some account Id"', 'Maximum', 300))`, *actualInput.MetricDataQueries[0].Expression)
	})
}

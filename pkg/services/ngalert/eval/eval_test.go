package eval

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestEvaluateExecutionResult(t *testing.T) {
	cases := []struct {
		desc               string
		execResults        ExecutionResults
		expectResultLength int
		expectResults      Results
	}{
		{
			desc: "zero valued single instance is single Normal state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{util.Pointer(0.0)})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Normal,
				},
			},
		},
		{
			desc: "non-zero valued single instance is single Alerting state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{util.Pointer(1.0)})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Alerting,
				},
			},
		},
		{
			desc: "nil value single instance is single a NoData state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{nil})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: NoData,
				},
			},
		},
		{
			desc: "an execution error produces a single Error state result",
			execResults: ExecutionResults{
				Error: fmt.Errorf("an execution error"),
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("an execution error"),
				},
			},
		},
		{
			desc:               "empty results produces a single NoData state result",
			execResults:        ExecutionResults{},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: NoData,
				},
			},
		},
		{
			desc: "frame with no fields produces a NoData state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame(""),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: NoData,
				},
			},
		},
		{
			desc: "empty field produces a NoData state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: NoData,
				},
			},
		},
		{
			desc: "empty field with labels produces a NoData state result with labels",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("", data.NewField("", data.Labels{"a": "b"}, []*float64{})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State:    NoData,
					Instance: data.Labels{"a": "b"},
				},
			},
		},
		{
			desc: "malformed frame (unequal lengths) produces Error state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{util.Pointer(23.0)}),
						data.NewField("", nil, []*float64{}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : unable to get frame row length: frame has different field lengths, field 0 is len 1 but field 1 is len 0"),
				},
			},
		},
		{
			desc: "too many fields produces Error state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{}),
						data.NewField("", nil, []*float64{}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : unexpected field length: 2 instead of 1"),
				},
			},
		},
		{
			desc: "more than one row produces Error state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{util.Pointer(2.0), util.Pointer(3.0)}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : unexpected row length: 2 instead of 0 or 1"),
				},
			},
		},
		{
			desc: "time fields (looks like time series) returns error",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []time.Time{}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : looks like time series data, only reduced data can be alerted on."),
				},
			},
		},
		{
			desc: "non []*float64 field will produce Error state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []float64{2}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : invalid field type: []float64"),
				},
			},
		},
		{
			desc: "duplicate labels produce a single Error state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{util.Pointer(1.0)}),
					),
					data.NewFrame("",
						data.NewField("", nil, []*float64{util.Pointer(2.0)}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : frame cannot uniquely be identified by its labels: has duplicate results with labels {}"),
				},
			},
		},
		{
			desc: "error that produce duplicate empty labels produce a single Error state result",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("",
						data.NewField("", data.Labels{"a": "b"}, []float64{2}),
					),
					data.NewFrame("",
						data.NewField("", nil, []float64{2}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : frame cannot uniquely be identified by its labels: has duplicate results with labels {}"),
				},
			},
		},
		{
			desc: "certain errors will produce multiple mixed Error and other state results",
			execResults: ExecutionResults{
				Condition: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []float64{3}),
					),
					data.NewFrame("",
						data.NewField("", data.Labels{"a": "b"}, []*float64{util.Pointer(2.0)}),
					),
				},
			},
			expectResultLength: 2,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : invalid field type: []float64"),
				},
				{
					State:    Alerting,
					Instance: data.Labels{"a": "b"},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.desc, func(t *testing.T) {
			res := evaluateExecutionResult(tc.execResults, time.Time{})

			require.Equal(t, tc.expectResultLength, len(res))

			for i, r := range res {
				require.Equal(t, tc.expectResults[i].State, r.State)
				require.Equal(t, tc.expectResults[i].Instance, r.Instance)
				if tc.expectResults[i].State == Error {
					require.EqualError(t, tc.expectResults[i].Error, r.Error.Error())
				}
			}
		})
	}
}

func TestEvaluateExecutionResultsNoData(t *testing.T) {
	t.Run("no data for Ref ID will produce NoData result", func(t *testing.T) {
		results := ExecutionResults{
			NoData: map[string]string{
				"A": "1",
			},
		}
		v := evaluateExecutionResult(results, time.Time{})
		require.Len(t, v, 1)
		require.Equal(t, data.Labels{"datasource_uid": "1", "ref_id": "A"}, v[0].Instance)
		require.Equal(t, NoData, v[0].State)
	})

	t.Run("no data for Ref IDs will produce NoData result for each Ref ID", func(t *testing.T) {
		results := ExecutionResults{
			NoData: map[string]string{
				"A": "1",
				"B": "1",
				"C": "2",
			},
		}
		v := evaluateExecutionResult(results, time.Time{})
		require.Len(t, v, 2)

		datasourceUIDs := make([]string, 0, len(v))
		refIDs := make([]string, 0, len(v))

		for _, next := range v {
			require.Equal(t, NoData, next.State)

			datasourceUID, ok := next.Instance["datasource_uid"]
			require.True(t, ok)
			require.NotEqual(t, "", datasourceUID)
			datasourceUIDs = append(datasourceUIDs, datasourceUID)

			refID, ok := next.Instance["ref_id"]
			require.True(t, ok)
			require.NotEqual(t, "", refID)
			refIDs = append(refIDs, refID)
		}

		require.ElementsMatch(t, []string{"1", "2"}, datasourceUIDs)
		require.ElementsMatch(t, []string{"A,B", "C"}, refIDs)
	})
}

func TestValidate(t *testing.T) {
	type services struct {
		cache        *fakes.FakeCacheService
		pluginsStore *pluginstore.FakePluginStore
	}

	testCases := []struct {
		name      string
		condition func(services services) models.Condition
		error     bool
	}{
		{
			name:  "fail if no expressions",
			error: true,
			condition: func(_ services) models.Condition {
				return models.Condition{
					Condition: "A",
					Data:      []models.AlertQuery{},
				}
			},
		},
		{
			name:  "fail if condition RefID does not exist",
			error: true,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds.Type,
						Backend: true,
					},
				})

				return models.Condition{
					Condition: "C",
					Data: []models.AlertQuery{
						dsQuery,
						models.CreateClassicConditionExpression("B", dsQuery.RefID, "last", "gt", rand.Int()),
					},
				}
			},
		},
		{
			name:  "fail if condition RefID is empty",
			error: true,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds.Type,
						Backend: true,
					},
				})
				return models.Condition{
					Condition: "",
					Data: []models.AlertQuery{
						dsQuery,
						models.CreateClassicConditionExpression("B", dsQuery.RefID, "last", "gt", rand.Int()),
					},
				}
			},
		},
		{
			name:  "fail if datasource with UID does not exists",
			error: true,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				// do not update the cache service
				return models.Condition{
					Condition: dsQuery.RefID,
					Data: []models.AlertQuery{
						dsQuery,
					},
				}
			},
		},
		{
			name:  "fail if datasource cannot be found in plugin store",
			error: true,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				// do not update the plugin store
				return models.Condition{
					Condition: dsQuery.RefID,
					Data: []models.AlertQuery{
						dsQuery,
					},
				}
			},
		},
		{
			name:  "fail if datasource is not backend one",
			error: true,
			condition: func(services services) models.Condition {
				dsQuery1 := models.GenerateAlertQuery()
				dsQuery2 := models.GenerateAlertQuery()
				ds1 := &datasources.DataSource{
					UID:  dsQuery1.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				ds2 := &datasources.DataSource{
					UID:  dsQuery2.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds1, ds2)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds1.Type,
						Backend: false,
					},
				}, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds2.Type,
						Backend: true,
					},
				})
				// do not update the plugin store
				return models.Condition{
					Condition: dsQuery1.RefID,
					Data: []models.AlertQuery{
						dsQuery1,
						dsQuery2,
					},
				}
			},
		},
		{
			name:  "pass if datasource exists and condition is correct",
			error: false,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds.Type,
						Backend: true,
					},
				})

				return models.Condition{
					Condition: "B",
					Data: []models.AlertQuery{
						dsQuery,
						models.CreateClassicConditionExpression("B", dsQuery.RefID, "last", "gt", rand.Int()),
					},
				}
			},
		},
		{
			name:  "fail if hysteresis command is not the condition",
			error: true,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds.Type,
						Backend: true,
					},
				})

				return models.Condition{
					Condition: "C",
					Data: []models.AlertQuery{
						dsQuery,
						models.CreateHysteresisExpression(t, "B", dsQuery.RefID, 4, 1),
						models.CreateClassicConditionExpression("C", "B", "last", "gt", rand.Int()),
					},
				}
			},
		},
		{
			name:  "pass if hysteresis command and it is the condition",
			error: false,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds.Type,
						Backend: true,
					},
				})

				return models.Condition{
					Condition: "B",
					Data: []models.AlertQuery{
						dsQuery,
						models.CreateHysteresisExpression(t, "B", dsQuery.RefID, 4, 1),
					},
				}
			},
		},
	}

	for _, testCase := range testCases {
		u := &user.SignedInUser{}

		t.Run(testCase.name, func(t *testing.T) {
			cacheService := &fakes.FakeCacheService{}
			store := &pluginstore.FakePluginStore{}
			condition := testCase.condition(services{
				cache:        cacheService,
				pluginsStore: store,
			})

			expressions := expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil, featuremgmt.WithFeatures(), nil, tracing.InitializeTracerForTest())
			validator := NewConditionValidator(cacheService, expressions, store)
			evalCtx := NewContext(context.Background(), u)

			err := validator.Validate(evalCtx, condition)
			if testCase.error {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestCreate_HysteresisCommand(t *testing.T) {
	type services struct {
		cache        *fakes.FakeCacheService
		pluginsStore *pluginstore.FakePluginStore
	}

	testCases := []struct {
		name      string
		reader    AlertingResultsReader
		condition func(services services) models.Condition
		error     bool
	}{
		{
			name:  "fail if hysteresis command is not the condition",
			error: true,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds.Type,
						Backend: true,
					},
				})

				return models.Condition{
					Condition: "C",
					Data: []models.AlertQuery{
						dsQuery,
						models.CreateHysteresisExpression(t, "B", dsQuery.RefID, 4, 1),
						models.CreateClassicConditionExpression("C", "B", "last", "gt", rand.Int()),
					},
				}
			},
		},
		{
			name:   "populate with loaded metrics",
			error:  false,
			reader: FakeLoadedMetricsReader{fingerprints: map[data.Fingerprint]struct{}{1: {}, 2: {}, 3: {}}},
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds.Type,
						Backend: true,
					},
				})

				return models.Condition{
					Condition: "B",
					Data: []models.AlertQuery{
						dsQuery,
						models.CreateHysteresisExpression(t, "B", dsQuery.RefID, 4, 1),
					},
				}
			},
		},
		{
			name:   "do nothing if reader is not specified",
			error:  false,
			reader: nil,
			condition: func(services services) models.Condition {
				dsQuery := models.GenerateAlertQuery()
				ds := &datasources.DataSource{
					UID:  dsQuery.DatasourceUID,
					Type: util.GenerateShortUID(),
				}
				services.cache.DataSources = append(services.cache.DataSources, ds)
				services.pluginsStore.PluginList = append(services.pluginsStore.PluginList, pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID:      ds.Type,
						Backend: true,
					},
				})

				return models.Condition{
					Condition: "B",
					Data: []models.AlertQuery{
						dsQuery,
						models.CreateHysteresisExpression(t, "B", dsQuery.RefID, 4, 1),
					},
				}
			},
		},
	}

	for _, testCase := range testCases {
		u := &user.SignedInUser{}

		t.Run(testCase.name, func(t *testing.T) {
			cacheService := &fakes.FakeCacheService{}
			store := &pluginstore.FakePluginStore{}
			condition := testCase.condition(services{
				cache:        cacheService,
				pluginsStore: store,
			})
			evaluator := NewEvaluatorFactory(setting.UnifiedAlertingSettings{}, cacheService, expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil, featuremgmt.WithFeatures(), nil, tracing.InitializeTracerForTest()))
			evalCtx := NewContextWithPreviousResults(context.Background(), u, testCase.reader)

			eval, err := evaluator.Create(evalCtx, condition)
			if testCase.error {
				require.Error(t, err)
				return
			}
			require.IsType(t, &conditionEvaluator{}, eval)
			ce := eval.(*conditionEvaluator)

			cmds := expr.GetCommandsFromPipeline[*expr.HysteresisCommand](ce.pipeline)
			require.Len(t, cmds, 1)
			if testCase.reader == nil {
				require.Empty(t, cmds[0].LoadedDimensions)
			} else {
				require.EqualValues(t, testCase.reader.Read(), cmds[0].LoadedDimensions)
			}
		})
	}
}

func TestQueryDataResponseToExecutionResults(t *testing.T) {
	t.Run("should set datasource type for captured values", func(t *testing.T) {
		c := models.Condition{
			Condition: "B",
			Data: []models.AlertQuery{
				{
					RefID:         "A",
					DatasourceUID: "test-ds",
				},
				{
					RefID:         "B",
					DatasourceUID: expr.DatasourceUID,
				},
			},
		}

		execResp := &backend.QueryDataResponse{
			Responses: backend.Responses{
				"A": {
					Frames: []*data.Frame{
						{
							RefID: "A",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						},
					},
				},
				"B": {
					Frames: []*data.Frame{
						{
							RefID: "B",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(1.0)},
								),
							},
						},
					},
				},
			},
		}

		results := queryDataResponseToExecutionResults(c, execResp)
		evaluatedResults := evaluateExecutionResult(results, time.Now())

		require.Len(t, evaluatedResults, 1)
		result := evaluatedResults[0]

		// Validate that IsDatasourceNode were correctly set
		require.True(t, result.Values["A"].IsDatasourceNode)
		require.False(t, result.Values["B"].IsDatasourceNode)
	})
}

func TestEvaluate(t *testing.T) {
	cases := []struct {
		name     string
		cond     models.Condition
		resp     backend.QueryDataResponse
		expected Results
		error    string
	}{
		{
			name: "is no data with no frames",
			cond: models.Condition{
				Data: []models.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "test",
				}, {
					RefID:         "B",
					DatasourceUID: expr.DatasourceUID,
				}, {
					RefID:         "C",
					DatasourceUID: expr.OldDatasourceUID,
				}, {
					RefID:         "D",
					DatasourceUID: expr.MLDatasourceUID,
				}},
			},
			resp: backend.QueryDataResponse{
				Responses: backend.Responses{
					"A": {Frames: nil},
					"B": {Frames: []*data.Frame{{Fields: nil}}},
					"C": {Frames: nil},
					"D": {Frames: []*data.Frame{{Fields: nil}}},
				},
			},
			expected: Results{{
				State: NoData,
				Instance: data.Labels{
					"datasource_uid": "test",
					"ref_id":         "A",
				},
			}},
		},
		{
			name: "is no data for one frame with no fields",
			cond: models.Condition{
				Data: []models.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "test",
				}},
			},
			resp: backend.QueryDataResponse{
				Responses: backend.Responses{
					"A": {Frames: []*data.Frame{{Fields: nil}}},
				},
			},
			expected: Results{{
				State: NoData,
				Instance: data.Labels{
					"datasource_uid": "test",
					"ref_id":         "A",
				},
			}},
		},
		{
			name: "results contains captured values for exact label matches",
			cond: models.Condition{
				Condition: "B",
			},
			resp: backend.QueryDataResponse{
				Responses: backend.Responses{
					"A": {
						Frames: []*data.Frame{{
							RefID: "A",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						}},
					},
					"B": {
						Frames: []*data.Frame{{
							RefID: "B",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(1.0)},
								),
							},
						}},
					},
				},
			},
			expected: Results{{
				State: Alerting,
				Instance: data.Labels{
					"foo": "bar",
				},
				Values: map[string]NumberValueCapture{
					"A": {
						Var:    "A",
						Labels: data.Labels{"foo": "bar"},
						Value:  util.Pointer(10.0),
					},
					"B": {
						Var:    "B",
						Labels: data.Labels{"foo": "bar"},
						Value:  util.Pointer(1.0),
					},
				},
				EvaluationString: "[ var='A' labels={foo=bar} value=10 ], [ var='B' labels={foo=bar} value=1 ]",
			}},
		},
		{
			name: "results contains captured values for subset of labels",
			cond: models.Condition{
				Condition: "B",
			},
			resp: backend.QueryDataResponse{
				Responses: backend.Responses{
					"A": {
						Frames: []*data.Frame{{
							RefID: "A",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						}},
					},
					"B": {
						Frames: []*data.Frame{{
							RefID: "B",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar", "bar": "baz"},
									[]*float64{util.Pointer(1.0)},
								),
							},
						}},
					},
				},
			},
			expected: Results{{
				State: Alerting,
				Instance: data.Labels{
					"foo": "bar",
					"bar": "baz",
				},
				Values: map[string]NumberValueCapture{
					"A": {
						Var:    "A",
						Labels: data.Labels{"foo": "bar"},
						Value:  util.Pointer(10.0),
					},
					"B": {
						Var:    "B",
						Labels: data.Labels{"foo": "bar", "bar": "baz"},
						Value:  util.Pointer(1.0),
					},
				},
				EvaluationString: "[ var='A' labels={foo=bar} value=10 ], [ var='B' labels={bar=baz, foo=bar} value=1 ]",
			}},
		},
		{
			name: "results contains error if condition frame has error",
			cond: models.Condition{
				Condition: "B",
			},
			resp: backend.QueryDataResponse{
				Responses: backend.Responses{
					"A": {
						Frames: []*data.Frame{{
							RefID: "A",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						}},
					},
					"B": {
						Frames: []*data.Frame{{
							RefID: "B",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar", "bar": "baz"},
									[]*float64{util.Pointer(1.0)},
								),
							},
						}},
						Error: errors.New("some frame error"),
					},
				},
			},
			expected: Results{{
				State:            Error,
				Error:            errors.New("some frame error"),
				EvaluationString: "",
			}},
		},
		{
			name: "results contain underlying error if condition frame has error that depends on another node",
			cond: models.Condition{
				Condition: "B",
			},
			resp: backend.QueryDataResponse{
				Responses: backend.Responses{
					"A": {
						Frames: []*data.Frame{{
							RefID: "A",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						}},
						Error: errors.New("another error depends on me"),
					},
					"B": {
						Frames: []*data.Frame{{
							RefID: "B",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar", "bar": "baz"},
									[]*float64{util.Pointer(1.0)},
								),
							},
						}},
						Error: expr.MakeDependencyError("B", "A"),
					},
				},
			},
			expected: Results{{
				State:            Error,
				Error:            errors.New("another error depends on me"),
				EvaluationString: "",
			}},
		},
		{
			name: "result values for all refIDs when a math no-op expression is used and two results share the same frame pointer",
			cond: models.Condition{
				Condition: "C",
			},
			resp: backend.QueryDataResponse{
				Responses: backend.Responses{
					"A": {
						Frames: []*data.Frame{{
							RefID: "A",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						}},
					},
					"B": {
						// in a math no-op expression the frame for B is the same as A
						// e.g. A = some_query, B = `${A}`
						Frames: []*data.Frame{{
							RefID: "A",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						}},
					},
					"C": {
						Frames: []*data.Frame{{
							RefID: "C",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(1.0)},
								),
							},
						}},
					},
				},
			},
			expected: Results{{
				State: Alerting,
				Instance: data.Labels{
					"foo": "bar",
				},
				Values: map[string]NumberValueCapture{
					"A": {
						Var:    "A",
						Labels: data.Labels{"foo": "bar"},
						Value:  util.Pointer(10.0),
					},
					"B": {
						Var:    "B",
						Labels: data.Labels{"foo": "bar"},
						Value:  util.Pointer(10.0),
					},
					"C": {
						Var:    "C",
						Labels: data.Labels{"foo": "bar"},
						Value:  util.Pointer(1.0),
					},
				},
				EvaluationString: "[ var='A' labels={foo=bar} value=10 ], [ var='B' labels={foo=bar} value=10 ], [ var='C' labels={foo=bar} value=1 ]",
			}},
		},
		{
			name: "range query with reducer includes only reducer and condition values in EvaluationString",
			cond: models.Condition{
				Condition: "C",
			},
			resp: backend.QueryDataResponse{
				Responses: backend.Responses{
					"A": {
						// This simulates a range query data response with time series data
						Frames: []*data.Frame{{
							RefID: "A",
							Fields: []*data.Field{
								data.NewField(
									"Time",
									nil,
									[]time.Time{time.Now(), time.Now().Add(10 * time.Second)},
								),
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0), util.Pointer(20.0)},
								),
							},
						}},
					},
					"B": {
						// Reduce node
						Frames: []*data.Frame{{
							RefID: "B",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(15.0)},
								),
							},
							Meta: &data.FrameMeta{
								Custom: []NumberValueCapture{
									{
										Var:              "B",
										IsDatasourceNode: false,
										Labels:           data.Labels{"foo": "bar"},
										Value:            util.Pointer(15.0),
									},
								},
							},
						}},
					},
					"C": {
						// Threshold
						Frames: []*data.Frame{{
							RefID: "C",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(1.0)},
								),
							},
							Meta: &data.FrameMeta{
								Custom: []NumberValueCapture{
									{
										Var:              "B",
										IsDatasourceNode: false,
										Labels:           data.Labels{"foo": "bar"},
										Value:            util.Pointer(15.0),
									},
									{
										Var:              "C",
										IsDatasourceNode: false,
										Labels:           data.Labels{"foo": "bar"},
										Value:            util.Pointer(1.0),
									},
								},
							},
						}},
					},
				},
			},
			expected: Results{{
				State: Alerting,
				Instance: data.Labels{
					"foo": "bar",
				},
				Values: map[string]NumberValueCapture{
					"B": {
						Var:              "B",
						IsDatasourceNode: false,
						Labels:           data.Labels{"foo": "bar"},
						Value:            util.Pointer(15.0),
					},
					"C": {
						Var:              "C",
						IsDatasourceNode: false,
						Labels:           data.Labels{"foo": "bar"},
						Value:            util.Pointer(1.0),
					},
				},
				// Note the absence of "A" in the EvaluationString.
				// For range queries, the raw datasource values are not included
				EvaluationString: "[ var='B' labels={foo=bar} value=15 ], [ var='C' labels={foo=bar} value=1 ]",
			}},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ev := conditionEvaluator{
				pipeline: nil,
				expressionService: &fakeExpressionService{
					hook: func(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error) {
						return &tc.resp, nil
					},
				},
				condition: tc.cond,
			}
			results, err := ev.Evaluate(context.Background(), time.Now())
			if tc.error != "" {
				require.EqualError(t, err, tc.error)
			} else {
				require.NoError(t, err)
				require.Len(t, results, len(tc.expected))
				for i := range results {
					tc.expected[i].EvaluatedAt = results[i].EvaluatedAt
					tc.expected[i].EvaluationDuration = results[i].EvaluationDuration
					assert.Equal(t, tc.expected[i], results[i])
				}
			}
		})
	}
}

func TestEvaluateRaw(t *testing.T) {
	t.Run("should timeout if request takes too long", func(t *testing.T) {
		unexpectedResponse := &backend.QueryDataResponse{}

		e := conditionEvaluator{
			pipeline: nil,
			expressionService: &fakeExpressionService{
				hook: func(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error) {
					ts := time.Now()
					for time.Since(ts) <= 10*time.Second {
						if ctx.Err() != nil {
							return nil, ctx.Err()
						}
						time.Sleep(10 * time.Millisecond)
					}
					return unexpectedResponse, nil
				},
			},
			condition:   models.Condition{},
			evalTimeout: 10 * time.Millisecond,
		}

		_, err := e.EvaluateRaw(context.Background(), time.Now())
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})
}

func TestEvaluateRawLimit(t *testing.T) {
	t.Run("should apply the limit to the successful query evaluation", func(t *testing.T) {
		resp := backend.QueryDataResponse{
			Responses: backend.Responses{
				"A": {
					Frames: []*data.Frame{{
						RefID: "A",
						Fields: []*data.Field{
							data.NewField(
								"Value",
								data.Labels{"foo": "bar"},
								[]*float64{util.Pointer(10.0)},
							),
						},
					}},
				},
				"B": {
					Frames: []*data.Frame{
						{
							RefID: "B",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "bar"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						},
						{
							RefID: "B",
							Fields: []*data.Field{
								data.NewField(
									"Value",
									data.Labels{"foo": "baz"},
									[]*float64{util.Pointer(10.0)},
								),
							},
						},
					},
				},
			},
		}

		cases := []struct {
			desc            string
			cond            models.Condition
			evalResultLimit int
			error           string
		}{
			{
				desc:            "too many results from the condition query results in an error",
				cond:            models.Condition{Condition: "B"},
				evalResultLimit: 1,
				error:           "query evaluation returned too many results: 2 (limit: 1)",
			},
			{
				desc:            "if the limit equals to the number of condition query frames, no error is returned",
				cond:            models.Condition{Condition: "B"},
				evalResultLimit: len(resp.Responses["B"].Frames),
			},
			{
				desc:            "if the limit is 0, no error is returned",
				cond:            models.Condition{Condition: "B"},
				evalResultLimit: 0,
			},
			{
				desc:            "if the limit is -1, no error is returned",
				cond:            models.Condition{Condition: "B"},
				evalResultLimit: -1,
			},
		}

		for _, tc := range cases {
			t.Run(tc.desc, func(t *testing.T) {
				e := conditionEvaluator{
					pipeline: nil,
					expressionService: &fakeExpressionService{
						hook: func(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error) {
							return &resp, nil
						},
					},
					condition:       tc.cond,
					evalResultLimit: tc.evalResultLimit,
				}

				result, err := e.EvaluateRaw(context.Background(), time.Now())

				if tc.error != "" {
					require.Error(t, err)
					require.EqualError(t, err, tc.error)
				} else {
					require.NoError(t, err)
					require.NotNil(t, result)
				}
			})
		}
	})

	t.Run("should return the original error if the evaluation did not succeed", func(t *testing.T) {
		cases := []struct {
			desc            string
			queryEvalResult *backend.QueryDataResponse
			queryEvalError  error
			evalResultLimit int
		}{
			{
				desc:            "the original query evaluation result is preserved",
				queryEvalResult: &backend.QueryDataResponse{},
				queryEvalError:  errors.New("some query error"),
				evalResultLimit: 1,
			},
			{
				desc:            "the original query evaluation result is preserved (no evaluation result)",
				queryEvalResult: nil,
				queryEvalError:  errors.New("some query error"),
				evalResultLimit: 1,
			},
		}

		for _, tc := range cases {
			t.Run(tc.desc, func(t *testing.T) {
				e := conditionEvaluator{
					pipeline: nil,
					expressionService: &fakeExpressionService{
						hook: func(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error) {
							return tc.queryEvalResult, tc.queryEvalError
						},
					},
					evalResultLimit: tc.evalResultLimit,
				}

				result, err := e.EvaluateRaw(context.Background(), time.Now())
				require.Error(t, err)
				require.Equal(t, err, tc.queryEvalError)
				require.Equal(t, result, tc.queryEvalResult)
			})
		}
	})
}

func TestResults_HasNonRetryableErrors(t *testing.T) {
	tc := []struct {
		name     string
		eval     Results
		expected bool
	}{
		{
			name: "with invalid format error",
			eval: Results{
				{
					State: Error,
					Error: &invalidEvalResultFormatError{refID: "A", reason: "unable to get frame row length", err: errors.New("weird error")},
				},
			},
			expected: true,
		},
		{
			name: "with expected wide series but got type long error",
			eval: Results{
				{
					State: Error,
					Error: fmt.Errorf("%w but got type long", expr.ErrSeriesMustBeWide),
				},
			},
			expected: true,
		},
		{
			name: "with retryable errors",
			eval: Results{
				{
					State: Error,
					Error: errors.New("some weird error"),
				},
			},
			expected: false,
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, tt.eval.HasNonRetryableErrors())
		})
	}
}

func TestResults_Error(t *testing.T) {
	tc := []struct {
		name     string
		eval     Results
		expected string
	}{
		{
			name: "with non-retryable errors",
			eval: Results{
				{
					State: Error,
					Error: &invalidEvalResultFormatError{refID: "A", reason: "unable to get frame row length", err: errors.New("weird error")},
				},
				{
					State: Error,
					Error: errors.New("unable to get a data frame"),
				},
			},
			expected: "invalid format of evaluation results for the alert definition A: unable to get frame row length: weird error\nunable to get a data frame",
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, tt.eval.Error().Error())
		})
	}
}

func TestCreate(t *testing.T) {
	t.Run("should generate headers from metadata", func(t *testing.T) {
		orgID := rand.Int63()
		ctx := models.WithRuleKey(context.Background(), models.GenerateRuleKey(orgID))
		q := models.CreateClassicConditionExpression("A", "B", "avg", "gt", 1)
		condition := models.Condition{
			Condition: q.RefID,
			Data: []models.AlertQuery{
				q,
			},
			Metadata: map[string]string{
				"Test1": "data1",
				"Test2": "музыка 🎶",
				"Test3": "",
			},
		}

		expectedHeaders := map[string]string{
			"http_X-Rule-Test1":        "data1",
			"http_X-Rule-Test2":        "%D0%BC%D1%83%D0%B7%D1%8B%D0%BA%D0%B0+%F0%9F%8E%B6",
			"http_X-Rule-Test3":        "",
			models.FromAlertHeaderName: "true",
			models.CacheSkipHeaderName: "true",
			"X-Grafana-Org-Id":         strconv.FormatInt(orgID, 10),
		}

		var request *expr.Request

		factory := evaluatorImpl{
			expressionService: fakeExpressionService{
				buildHook: func(req *expr.Request) (expr.DataPipeline, error) {
					if request != nil {
						assert.Fail(t, "BuildPipeline was called twice but should be only once")
					}
					request = req
					return expr.DataPipeline{
						fakeNode{refID: q.RefID},
					}, nil
				},
			},
		}

		_, err := factory.Create(NewContext(ctx, &user.SignedInUser{}), condition)
		require.NoError(t, err)

		require.NotNil(t, request)

		require.Equal(t, expectedHeaders, request.Headers)
	})
}

type fakeExpressionService struct {
	hook      func(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error)
	buildHook func(req *expr.Request) (expr.DataPipeline, error)
}

func (f fakeExpressionService) ExecutePipeline(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error) {
	return f.hook(ctx, now, pipeline)
}

func (f fakeExpressionService) BuildPipeline(req *expr.Request) (expr.DataPipeline, error) {
	return f.buildHook(req)
}

type fakeNode struct {
	refID string
}

func (f fakeNode) ID() int64 {
	return 0
}

func (f fakeNode) NodeType() expr.NodeType {
	return expr.TypeCMDNode
}

func (f fakeNode) RefID() string {
	return f.refID
}

func (f fakeNode) String() string {
	return "Fake"
}

func (f fakeNode) NeedsVars() []string {
	return nil
}

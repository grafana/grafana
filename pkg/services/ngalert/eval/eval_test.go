package eval

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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
				Results: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{ptr.Float64(0)})),
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
				Results: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{ptr.Float64(1)})),
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
				Results: []*data.Frame{
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
				Results: []*data.Frame{
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
				Results: []*data.Frame{
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
				Results: []*data.Frame{
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
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{ptr.Float64(23)}),
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
				Results: []*data.Frame{
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
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{ptr.Float64(2), ptr.Float64(3)}),
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
				Results: []*data.Frame{
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
				Results: []*data.Frame{
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
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{ptr.Float64(1)}),
					),
					data.NewFrame("",
						data.NewField("", nil, []*float64{ptr.Float64(2)}),
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
				Results: []*data.Frame{
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
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []float64{3}),
					),
					data.NewFrame("",
						data.NewField("", data.Labels{"a": "b"}, []*float64{ptr.Float64(2)}),
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
	testCases := []struct {
		name      string
		condition func(service *fakes.FakeCacheService) models.Condition
		error     bool
	}{
		{
			name:  "fail if no expressions",
			error: true,
			condition: func(service *fakes.FakeCacheService) models.Condition {
				return models.Condition{
					Condition: "A",
					Data:      []models.AlertQuery{},
				}
			},
		},
		{
			name:  "fail if condition RefID does not exist",
			error: true,
			condition: func(service *fakes.FakeCacheService) models.Condition {
				ds := models.GenerateAlertQuery()
				service.DataSources = append(service.DataSources, &datasources.DataSource{
					Uid: ds.DatasourceUID,
				})

				return models.Condition{
					Condition: "C",
					Data: []models.AlertQuery{
						ds,
						models.CreateClassicConditionExpression("B", ds.RefID, "last", "gt", rand.Int()),
					},
				}
			},
		},
		{
			name:  "fail if condition RefID is empty",
			error: true,
			condition: func(service *fakes.FakeCacheService) models.Condition {
				ds := models.GenerateAlertQuery()
				service.DataSources = append(service.DataSources, &datasources.DataSource{
					Uid: ds.DatasourceUID,
				})

				return models.Condition{
					Condition: "",
					Data: []models.AlertQuery{
						ds,
						models.CreateClassicConditionExpression("B", ds.RefID, "last", "gt", rand.Int()),
					},
				}
			},
		},
		{
			name:  "fail if datasource with UID does not exists",
			error: true,
			condition: func(service *fakes.FakeCacheService) models.Condition {
				ds := models.GenerateAlertQuery()
				// do not update the cache service
				return models.Condition{
					Condition: ds.RefID,
					Data: []models.AlertQuery{
						ds,
					},
				}
			},
		},
		{
			name:  "pass if datasource exists and condition is correct",
			error: false,
			condition: func(service *fakes.FakeCacheService) models.Condition {
				ds := models.GenerateAlertQuery()
				service.DataSources = append(service.DataSources, &datasources.DataSource{
					Uid: ds.DatasourceUID,
				})

				return models.Condition{
					Condition: "B",
					Data: []models.AlertQuery{
						ds,
						models.CreateClassicConditionExpression("B", ds.RefID, "last", "gt", rand.Int()),
					},
				}
			},
		},
	}

	for _, testCase := range testCases {
		u := &user.SignedInUser{}

		t.Run(testCase.name, func(t *testing.T) {
			cacheService := &fakes.FakeCacheService{}
			condition := testCase.condition(cacheService)

			evaluator := NewEvaluator(&setting.Cfg{ExpressionsEnabled: true}, log.New("test"), cacheService, expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil))

			err := evaluator.Validate(context.Background(), u, condition)
			if testCase.error {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

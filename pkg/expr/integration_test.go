package expr

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestDSNodeAndCMDNodeExecution(t *testing.T) {
	// We'll need a context and time value for execution
	ctx := context.Background()
	now := time.Now()

	// Create a mock data service that returns predictable data when QueryData is called
	mockDataResponse := &backend.QueryDataResponse{
		Responses: backend.Responses{
			"A": backend.DataResponse{
				Frames: data.Frames{
					data.NewFrame("test",
						data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
						data.NewField("value", data.Labels{"test": "label"}, []*float64{fp(2)}),
					),
				},
			},
		},
	}

	mockDataService := &mockDataService{
		response: mockDataResponse,
	}

	// Create a mock plugin context provider
	pCtxProvider := &mockPluginContextProvider{}

	// Create the service with our mocks
	svc := &Service{
		dataService:  mockDataService,
		pCtxProvider: pCtxProvider,
		tracer:       tracing.InitializeTracerForTest(),
		metrics:      newMetrics(nil),
		features:     featuremgmt.WithFeatures(),
		converter: &ResultConverter{
			Features: featuremgmt.WithFeatures(),
			Tracer:   tracing.InitializeTracerForTest(),
		},
	}

	// Create a DSNode
	dsNode := &DSNode{
		baseNode: baseNode{
			id:    1,
			refID: "A",
		},
		datasource: &datasources.DataSource{
			OrgID: 1,
			UID:   "test",
			Type:  "test",
		},
		orgID:      1,
		query:      json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		queryType:  "",
		intervalMS: 1000,
		maxDP:      1000,
		timeRange: AbsoluteTimeRange{
			From: time.Time{},
			To:   time.Time{},
		},
		request: Request{
			OrgId: 1,
			User:  &user.SignedInUser{},
		},
	}

	// Create a math CMDNode that depends on the DSNode
	mathCommand, err := NewMathCommand("B", "$A * 2")
	require.NoError(t, err)

	cmdNode := &CMDNode{
		baseNode: baseNode{
			id:    2,
			refID: "B",
		},
		CMDType: TypeMath,
		Command: mathCommand,
	}

	// Execute the DSNode
	vars := make(mathexp.Vars)
	dsResult, err := dsNode.Execute(ctx, now, vars, svc)
	require.NoError(t, err)

	// Store the DSNode result in vars
	vars[dsNode.RefID()] = dsResult

	// Execute the CMDNode with the DSNode result
	cmdResult, err := cmdNode.Execute(ctx, now, vars, svc)
	require.NoError(t, err)

	// Check the results
	require.NoError(t, cmdResult.Error)
	require.Len(t, cmdResult.Values, 1)

	// The result should be a series with a value of 4 (2*2)
	series, ok := cmdResult.Values[0].(mathexp.Series)
	require.True(t, ok, "Expected result to be a series")
	require.Equal(t, 1, series.Len())

	_, val := series.GetPoint(0)
	require.True(t, ok)
	require.Equal(t, float64(4), *val)
}

func TestSQLExpressionsIsLossless(t *testing.T) {
	// We'll need a context and time value for execution
	ctx := context.Background()
	now := time.Now()

	// This data is in Numeric-Multi format
	// The data itself is equivalent to this CSV (but across multiple frames)
	// "Time","host","sparse_label","Value"
	// 0,dummy_a,label_value_present,13
	// 0,dummy_b,,17

	// Importantly, one of the labels ("sparse_label") is sparse
	// We test that conversion to SQL and back is lossless,
	// and specifically that gaps in the sparse label are not converted to an empty string

	// I (Sam) was able to query for data in this shape as follows:
	// Prometheus data source query, Type: Instant, Format: Table,
	//     sum by(host, sparse_label) (metric_name{host="dummy_a"})
	//     or
	//     sum by(host) (metric_name{host="dummy_b"})
	times := []time.Time{
		time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	input := data.Frames{
		data.NewFrame("frame1",
			data.NewField("ts", nil, times),
			data.NewField("value", data.Labels{"host": "dummy_a", "sparse_label": "label_value_present"}, []float64{13}),
		),
		data.NewFrame("frame1",
			data.NewField("ts", nil, times),
			data.NewField("value", data.Labels{"host": "dummy_b"}, []float64{17}),
		),
	}

	// Create a mock data service that returns predictable data when QueryData is called
	mockDataResponse := &backend.QueryDataResponse{
		Responses: backend.Responses{
			"A": backend.DataResponse{
				Frames: input,
			},
		},
	}

	mockDataService := &mockDataService{
		response: mockDataResponse,
	}

	// Create a mock plugin context provider
	pCtxProvider := &mockPluginContextProvider{}

	// Create the service with our mocks
	svc := &Service{
		dataService:  mockDataService,
		pCtxProvider: pCtxProvider,
		tracer:       tracing.InitializeTracerForTest(),
		metrics:      newMetrics(nil),
		features:     featuremgmt.WithFeatures(),
		converter: &ResultConverter{
			Features: featuremgmt.WithFeatures(),
			Tracer:   tracing.InitializeTracerForTest(),
		},
	}

	// Create a DSNode, which is an input to the SQL expression
	dsNode := &DSNode{
		baseNode: baseNode{
			id:    1,
			refID: "A",
		},
		datasource: &datasources.DataSource{
			OrgID: 1,
			UID:   "test",
			Type:  "test",
		},
		orgID:      1,
		query:      json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		queryType:  "",
		intervalMS: 1000,
		maxDP:      1000,
		timeRange: AbsoluteTimeRange{
			From: time.Time{},
			To:   time.Time{},
		},
		request: Request{
			OrgId: 1,
			User:  &user.SignedInUser{},
		},
		isInputToSQLExpr: true,
	}

	// Create a SQL Expression CMDNode that depends on the DSNode
	// Use the alerting format here to test that the SQL expression is lossless
	sqlCommand, err := NewSQLCommand("B", "alerting", "SELECT * FROM A", 0)
	require.NoError(t, err)

	cmdNode := &CMDNode{
		baseNode: baseNode{
			id:    2,
			refID: "B",
		},
		CMDType: TypeSQL,
		Command: sqlCommand,
	}

	// Execute the DSNode
	vars := make(mathexp.Vars)
	dsResult, err := dsNode.Execute(ctx, now, vars, svc)
	require.NoError(t, err)

	// Store the DSNode result in vars
	vars[dsNode.RefID()] = dsResult

	// Execute the CMDNode with the DSNode result
	cmdResult, err := cmdNode.Execute(ctx, now, vars, svc)
	require.NoError(t, err)
	require.NoError(t, cmdResult.Error)

	// Check the results
	// Result from SQL command with alerting format must include:
	// "Value","host","sparse_label"
	// 13,dummy_a,label_value_present
	// 17,dummy_b,
	// (It can optionally include the "Time" column, but it is not required)
	// Check we have the expected number of values
	require.Len(t, cmdResult.Values, 2)

	// Convert values to Number type for checking
	n1, ok := cmdResult.Values[0].(mathexp.Number)
	require.True(t, ok, "Expected first value to be mathexp.Number")
	n2, ok := cmdResult.Values[1].(mathexp.Number)
	require.True(t, ok, "Expected second value to be mathexp.Number")

	// Check first value
	require.Equal(t, float64(13), *n1.GetFloat64Value())
	labels1 := n1.GetLabels()
	require.Equal(t, "dummy_a", labels1["host"])
	require.Equal(t, "label_value_present", labels1["sparse_label"])

	// Check second value
	require.Equal(t, float64(17), *n2.GetFloat64Value())
	labels2 := n2.GetLabels()
	require.Equal(t, "dummy_b", labels2["host"])

	// Verify sparse_label is not present in second value's labels
	_, hasLabel := labels2["sparse_label"]
	require.False(t, hasLabel, "sparse_label should not be present in second value's labels")
}

// Mock implementations

type mockDataService struct {
	response *backend.QueryDataResponse
}

func (m *mockDataService) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return m.response, nil
}

type mockPluginContextProvider struct{}

func (m *mockPluginContextProvider) Get(ctx context.Context, pluginID string, user identity.Requester, orgID int64) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}

func (m *mockPluginContextProvider) GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}

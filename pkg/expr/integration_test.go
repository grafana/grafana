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

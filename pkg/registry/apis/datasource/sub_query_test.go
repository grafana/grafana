package datasource

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestSubQueryConnectWhenDatasourceNotFound(t *testing.T) {
	sqr := subQueryREST{
		builder: &DataSourceAPIBuilder{
			client: mockClient{
				lastCalledWithHeaders: &map[string]string{},
			},
			datasources:     mockDatasources{},
			contextProvider: mockContextProvider{},
		},
	}

	mr := mockResponder{}
	_, err := sqr.Connect(context.Background(), "dsname-that-does-not-exist", nil, mr)
	require.Error(t, err)
	var statusErr *k8serrors.StatusError
	require.True(t, errors.As(err, &statusErr))
	require.Equal(t, int32(404), statusErr.Status().Code)
}

func TestSubQueryConnectReturnsDownstreamErrorsAsQueryDataResponses(t *testing.T) {
	tests := []struct {
		name         string
		queryError   error
		errorMessage string
	}{
		{
			name:         "plugin SDK downstream error",
			queryError:   backend.DownstreamError(errors.New("failed to retrieve credentials")),
			errorMessage: "failed to retrieve credentials",
		},
		{
			name: "Grafana server downstream error",
			queryError: errutil.Error{
				Source:     errutil.SourceDownstream,
				LogMessage: "failed to retrieve server credentials",
			},
			errorMessage: "failed to retrieve server credentials",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			responder := executeSubQuery(t, tc.queryError)

			require.NoError(t, responder.err)
			require.Equal(t, http.StatusBadRequest, responder.statusCode)

			qdr, ok := responder.object.(*v0alpha1.QueryDataResponse)
			require.True(t, ok)
			for _, refID := range []string{"A", "B"} {
				require.Contains(t, qdr.Responses, refID)
				require.Equal(t, backend.StatusBadRequest, qdr.Responses[refID].Status)
				require.Equal(t, backend.ErrorSourceDownstream, qdr.Responses[refID].ErrorSource)
				require.EqualError(t, qdr.Responses[refID].Error, tc.errorMessage)
			}
		})
	}
}

func TestSubQueryConnectReturnsLifecycleErrorsAsDownstreamQueryDataResponses(t *testing.T) {
	for _, tc := range []struct {
		name       string
		queryError error
		status     backend.Status
	}{
		{
			name:       "canceled",
			queryError: context.Canceled,
			status:     backend.Status(499),
		},
		{
			name:       "downstream-wrapped canceled",
			queryError: backend.DownstreamError(context.Canceled),
			status:     backend.Status(499),
		},
		{
			name:       "deadline exceeded",
			queryError: context.DeadlineExceeded,
			status:     backend.Status(http.StatusRequestTimeout),
		},
		{
			name:       "downstream-wrapped deadline exceeded",
			queryError: backend.DownstreamError(context.DeadlineExceeded),
			status:     backend.Status(http.StatusRequestTimeout),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			responder := executeSubQuery(t, tc.queryError)

			require.NoError(t, responder.err)
			require.Equal(t, int(tc.status), responder.statusCode)

			qdr, ok := responder.object.(*v0alpha1.QueryDataResponse)
			require.True(t, ok)
			for _, refID := range []string{"A", "B"} {
				require.Contains(t, qdr.Responses, refID)
				require.Equal(t, tc.status, qdr.Responses[refID].Status)
				require.Equal(t, backend.ErrorSourceDownstream, qdr.Responses[refID].ErrorSource)
				require.EqualError(t, qdr.Responses[refID].Error, tc.queryError.Error())
			}
		})
	}
}

func TestSubQueryConnectDoesNotConvertOtherErrors(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
	}{
		{name: "untyped", err: errors.New("internal failure")},
		{name: "explicit plugin", err: backend.PluginError(errors.New("plugin failure"))},
	} {
		t.Run(tc.name, func(t *testing.T) {
			responder := executeSubQuery(t, tc.err)

			require.ErrorIs(t, responder.err, tc.err)
			require.Nil(t, responder.object)
		})
	}
}

func executeSubQuery(t *testing.T, queryErr error) *recordingResponder {
	t.Helper()

	headers := map[string]string{}
	sqr := subQueryREST{
		builder: &DataSourceAPIBuilder{
			client: mockClient{
				lastCalledWithHeaders: &headers,
				queryDataError:        queryErr,
			},
			datasources:     mockDatasources{},
			contextProvider: mockContextProvider{},
		},
	}

	responder := &recordingResponder{}
	handler, err := sqr.Connect(context.Background(), "dsname", nil, responder)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{
		"queries": [
			{
				"refId": "A",
				"datasource": {
					"type": "cloudwatch",
					"uid": "dsname"
				}
			},
			{
				"refId": "B",
				"datasource": {
					"type": "cloudwatch",
					"uid": "dsname"
				}
			}
		]
	}`))
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(httptest.NewRecorder(), req)

	return responder
}

type mockClient struct {
	lastCalledWithHeaders *map[string]string
	queryDataError        error
}

func (m mockClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	*m.lastCalledWithHeaders = req.Headers
	if m.queryDataError == nil {
		return nil, fmt.Errorf("mock error")
	}
	return nil, m.queryDataError
}

func (m mockClient) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	*m.lastCalledWithHeaders = req.Headers
	return fmt.Errorf("mock error")
}

func (m mockClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return nil
}

func (m mockClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, nil
}

func (m mockClient) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return nil, nil
}

type mockResponder struct {
}

// Object writes the provided object to the response. Invoking this method multiple times is undefined.
func (m mockResponder) Object(statusCode int, obj runtime.Object) {
}

// Error writes the provided error to the response. This method may only be invoked once.
func (m mockResponder) Error(err error) {
}

type recordingResponder struct {
	statusCode int
	object     runtime.Object
	err        error
}

func (r *recordingResponder) Object(statusCode int, obj runtime.Object) {
	r.statusCode = statusCode
	r.object = obj
}

func (r *recordingResponder) Error(err error) {
	r.err = err
}

var _ PluginDatasourceProvider = (*mockDatasources)(nil)

type mockDatasources struct {
}

// CreateDataSource implements PluginDatasourceProvider.
func (m mockDatasources) CreateDataSource(ctx context.Context, ds *v0alpha1.DataSource) (*v0alpha1.DataSource, error) {
	return nil, nil
}

// UpdateDataSource implements PluginDatasourceProvider.
func (m mockDatasources) UpdateDataSource(ctx context.Context, ds *v0alpha1.DataSource) (*v0alpha1.DataSource, error) {
	return nil, nil
}

// Delete implements PluginDatasourceProvider.
func (m mockDatasources) DeleteDataSource(ctx context.Context, uid string) error {
	return nil
}

// GetDataSource implements PluginDatasourceProvider.
func (m mockDatasources) GetDataSource(ctx context.Context, uid string) (*v0alpha1.DataSource, error) {
	return nil, nil
}

// ListDataSource implements PluginDatasourceProvider.
func (m mockDatasources) ListDataSources(ctx context.Context) (*v0alpha1.DataSourceList, error) {
	return nil, nil
}

// Get gets a specific datasource (that the user in context can see)
func (m mockDatasources) GetConnection(ctx context.Context, uid string) (*v0alpha1.DataSourceConnection, error) {
	return nil, nil
}

// List lists all data sources the user in context can see
func (m mockDatasources) ListConnections(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error) {
	return nil, nil
}

// Return settings (decrypted!) for a specific plugin
// This will require "query" permission for the user in context
func (m mockDatasources) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	if uid == "dsname" {
		return nil, nil
	}
	return nil, datasources.ErrDataSourceNotFound
}

type mockContextProvider struct {
}

func (m mockContextProvider) PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}

type streamingQueryClient struct {
	mockClient
	sendFrame bool
	streamErr error
}

func (c streamingQueryClient) QueryChunkedData(_ context.Context, _ *backend.QueryChunkedDataRequest, writer backend.ChunkedDataWriter) error {
	if c.sendFrame {
		if err := writer.(chunked.RawChunkReceiver).OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A", Status: 200}); err != nil {
			return err
		}
	}
	return c.streamErr
}

func TestSubQueryChunkedCompletion(t *testing.T) {
	for _, tc := range []struct {
		name           string
		enabled, frame bool
		streamErr      error
		terminal       bool
	}{
		{name: "successful frames", enabled: true, frame: true, terminal: true},
		{name: "successful empty query", enabled: true, terminal: true},
		{name: "failure before frames", enabled: true, streamErr: errors.New("failed before frames")},
		{name: "failure after frames", enabled: true, frame: true, streamErr: errors.New("failed after frames")},
		{name: "disabled", enabled: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sqr := subQueryREST{builder: &DataSourceAPIBuilder{
				client:      streamingQueryClient{sendFrame: tc.frame, streamErr: tc.streamErr},
				datasources: mockDatasources{}, contextProvider: mockContextProvider{},
				cfg: DataSourceAPIBuilderConfig{EnableChunkedQueryStreaming: tc.enabled},
			}}
			responder := &recordingResponder{}
			handler, err := sqr.Connect(context.Background(), "dsname", nil, responder)
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{"queries":[{"refId":"A","datasource":{"uid":"dsname","type":"cloudwatch"}}]}`))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Accept", chunked.CONTENT_TYPE)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)
			if tc.terminal {
				require.NoError(t, responder.err)
				require.Contains(t, recorder.Body.String(), `"type":"complete"`)
				_, err := chunked.AccumulateJSONLines(recorder.Body)
				require.NoError(t, err)
			} else {
				require.NotContains(t, recorder.Body.String(), `"type":"complete"`)
				if tc.frame {
					require.NoError(t, responder.err)
					require.Contains(t, recorder.Body.String(), `"type":"error"`)
					_, err := chunked.AccumulateJSONLines(recorder.Body)
					require.ErrorContains(t, err, tc.streamErr.Error())
				} else {
					require.Error(t, responder.err)
				}
			}
		})
	}
}

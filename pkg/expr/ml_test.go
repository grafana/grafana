package expr

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/expr/ml"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestMLNodeExecute(t *testing.T) {
	timeNow := time.Now()
	expectedOrgID := int64(123)
	timeRange := RelativeTimeRange{
		From: -10 * time.Hour,
		To:   0,
	}
	request := &Request{
		Headers: map[string]string{
			"test": "test",
		},
		Debug:   false,
		OrgId:   expectedOrgID,
		Queries: nil,
		User: &user.SignedInUser{
			UserID: 1,
		},
	}

	expectedResponse := &backend.CallResourceResponse{
		Status:  200,
		Headers: nil,
		Body:    []byte("test-response"),
	}

	pluginsClient := &recordingCallResourceHandler{
		response: expectedResponse,
	}

	pluginCtx := &fakePluginContextProvider{
		result: map[string]*backend.AppInstanceSettings{
			mlPluginID: {
				JSONData: json.RawMessage(`{ "initialized": true }`),
			},
		},
	}

	s := &Service{
		cfg:           nil,
		dataService:   nil,
		pCtxProvider:  pluginCtx,
		features:      nil,
		pluginsClient: pluginsClient,
		tracer:        nil,
		metrics:       metrics.NewSSEMetrics(nil),
	}

	cmdResponse := data.NewFrame("test",
		data.NewField("Time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("Value", nil, []*float64{fp(1)}),
	)

	cmd := &ml.FakeCommand{
		Method:  http.MethodPost,
		Path:    "/test/ml",
		Payload: []byte(`{}`),
		Response: &backend.QueryDataResponse{
			Responses: map[string]backend.DataResponse{
				"A": {
					Frames: data.Frames{
						cmdResponse,
					},
					Status: backend.StatusOK,
				},
			},
		},
		Error: nil,
	}

	node := &MLNode{
		baseNode:  baseNode{},
		command:   cmd,
		TimeRange: timeRange,
		request:   request,
	}

	result, err := node.Execute(context.Background(), timeNow, nil, s)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotEmpty(t, result.Values)

	t.Run("should get plugin context", func(t *testing.T) {
		require.NotEmpty(t, pluginCtx.recordings)
		require.Equal(t, "Get", pluginCtx.recordings[0].method)
		require.Equal(t, mlPluginID, pluginCtx.recordings[0].params[0])
		require.Equal(t, request.User, pluginCtx.recordings[0].params[1])
	})

	t.Run("should call command execute with correct parameters", func(t *testing.T) {
		require.NotEmpty(t, cmd.Recordings)
		rec := cmd.Recordings[0]
		require.Equal(t, timeRange.AbsoluteTime(timeNow).From, rec.From)
		require.Equal(t, timeRange.AbsoluteTime(timeNow).To, rec.To)
		require.NotNil(t, rec.Response)
		require.Equal(t, expectedResponse.Status, rec.Response.Status())
		require.Equal(t, expectedResponse.Body, rec.Response.Body())
	})

	t.Run("should call plugin API", func(t *testing.T) {
		require.NotEmpty(t, pluginsClient.recordings)
		req := pluginsClient.recordings[0]
		require.Equal(t, cmd.Payload, req.Body)
		require.Equal(t, cmd.Path, req.Path)
		require.Equal(t, cmd.Method, req.Method)

		require.NotNil(t, req.PluginContext)
		require.Equal(t, mlPluginID, req.PluginContext.PluginID)

		t.Run("should append request headers to API call", func(t *testing.T) {
			for key, value := range request.Headers {
				require.Contains(t, req.Headers, key)
				require.Equal(t, value, req.Headers[key][0])
			}
		})
	})

	t.Run("should fail if plugin is not installed", func(t *testing.T) {
		s := &Service{
			cfg:         nil,
			dataService: nil,
			pCtxProvider: &fakePluginContextProvider{
				errorResult: plugins.ErrPluginNotRegistered,
			},
			features:      nil,
			pluginsClient: nil,
			tracer:        nil,
			metrics:       nil,
		}

		_, err := node.Execute(context.Background(), timeNow, nil, s)
		require.ErrorIs(t, err, errMLPluginDoesNotExist)
	})

	t.Run("should fail if plugin settings cannot be retrieved", func(t *testing.T) {
		expectedErr := errors.New("test-error")
		s := &Service{
			cfg:         nil,
			dataService: nil,
			pCtxProvider: &fakePluginContextProvider{
				errorResult: expectedErr,
			},
			features:      nil,
			pluginsClient: nil,
			tracer:        nil,
			metrics:       nil,
		}

		_, err := node.Execute(context.Background(), timeNow, nil, s)
		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("should fail if plugin is not initialized", func(t *testing.T) {
		s := &Service{
			cfg:         nil,
			dataService: nil,
			pCtxProvider: &fakePluginContextProvider{
				result: map[string]*backend.AppInstanceSettings{
					mlPluginID: {
						JSONData: json.RawMessage(`{}`),
					},
				},
			},
			features:      nil,
			pluginsClient: nil,
			tracer:        nil,
			metrics:       nil,
		}

		_, err := node.Execute(context.Background(), timeNow, nil, s)
		require.ErrorIs(t, err, errMLPluginDoesNotExist)
	})

	t.Run("should return QueryError if command failed", func(t *testing.T) {
		s := &Service{
			cfg:           nil,
			dataService:   nil,
			pCtxProvider:  pluginCtx,
			features:      nil,
			pluginsClient: pluginsClient,
			tracer:        nil,
			metrics:       metrics.NewSSEMetrics(nil),
		}

		cmd := &ml.FakeCommand{
			Error: errors.New("failed to execute command"),
		}

		node := &MLNode{
			baseNode:  baseNode{},
			command:   cmd,
			TimeRange: timeRange,
			request:   request,
		}

		_, err := node.Execute(context.Background(), timeNow, nil, s)
		require.IsType(t, err, MakeQueryError("A", "", expectedError{}))
		require.ErrorIs(t, err, cmd.Error)
	})
}

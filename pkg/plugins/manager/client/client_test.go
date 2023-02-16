package client

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/stretchr/testify/require"
)

func TestQueryData(t *testing.T) {
	t.Run("Empty registry should return not registered error", func(t *testing.T) {
		registry := fakes.NewFakePluginRegistry()
		client := ProvideService(registry, &config.Cfg{})
		_, err := client.QueryData(context.Background(), &backend.QueryDataRequest{})
		require.Error(t, err)
		require.ErrorIs(t, err, plugins.ErrPluginNotRegistered)
	})

	t.Run("Non-empty registry", func(t *testing.T) {
		tcs := []struct {
			err           error
			expectedError error
		}{
			{
				err:           backendplugin.ErrPluginUnavailable,
				expectedError: plugins.ErrPluginUnavailable,
			},
			{
				err:           backendplugin.ErrMethodNotImplemented,
				expectedError: plugins.ErrMethodNotImplemented,
			},
			{
				err:           errors.New("surprise surprise"),
				expectedError: plugins.ErrPluginDownstreamError,
			},
		}

		for _, tc := range tcs {
			t.Run(fmt.Sprintf("Plugin client error %q should return expected error", tc.err), func(t *testing.T) {
				registry := fakes.NewFakePluginRegistry()
				p := &plugins.Plugin{
					JSONData: plugins.JSONData{
						ID: "grafana",
					},
				}
				p.RegisterClient(&fakePluginBackend{
					qdr: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
						return nil, tc.err
					},
				})
				err := registry.Add(context.Background(), p)
				require.NoError(t, err)

				client := ProvideService(registry, &config.Cfg{})
				_, err = client.QueryData(context.Background(), &backend.QueryDataRequest{
					PluginContext: backend.PluginContext{
						PluginID: "grafana",
					},
				})
				require.Error(t, err)
				require.ErrorIs(t, err, tc.expectedError)
			})
		}
	})
}

func TestCallResource(t *testing.T) {
	registry := fakes.NewFakePluginRegistry()
	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: "pid",
		},
	}

	const backendResponse = "I am the backend"

	t.Run("Should strip request and response hop-by-hop headers", func(t *testing.T) {
		reqHeaders := map[string][]string{
			"Connection":       {"close, TE"},
			"Te":               {"foo", "bar, trailers"},
			"Proxy-Connection": {"should be deleted"},
			"Upgrade":          {"foo"},
			"X-Custom":         {"should not be deleted"},
		}

		resHeaders := make(map[string][]string, len(reqHeaders))
		for k, v := range reqHeaders {
			resHeaders[k] = v
		}

		req := &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				PluginID: "pid",
			},
			Headers: reqHeaders,
		}

		responses := []*backend.CallResourceResponse{}
		sender := callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			responses = append(responses, res)
			return nil
		})

		var actualReq *backend.CallResourceRequest
		p.RegisterClient(&fakePluginBackend{
			crr: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				actualReq = req
				return sender.Send(&backend.CallResourceResponse{
					Headers: resHeaders,
					Status:  http.StatusOK,
					Body:    []byte(backendResponse),
				})
			},
		})
		err := registry.Add(context.Background(), p)
		require.NoError(t, err)

		client := ProvideService(registry, &config.Cfg{})

		err = client.CallResource(context.Background(), req, sender)
		require.NoError(t, err)

		require.NotNil(t, actualReq)
		require.Len(t, actualReq.Headers, 1)
		require.Equal(t, "should not be deleted", actualReq.Headers["X-Custom"][0])

		require.Len(t, responses, 1)
		res := responses[0]
		require.Equal(t, http.StatusOK, res.Status)
		require.Equal(t, []byte(backendResponse), res.Body)
		require.Len(t, res.Headers, 1)
		require.Equal(t, "should not be deleted", actualReq.Headers["X-Custom"][0])
	})

	t.Run("Should strip request and response headers present in Connection", func(t *testing.T) {
		//nolint:gosec
		const fakeConnectionToken = "X-fake-Connection-Token"

		// someConnHeader is some arbitrary header to be declared as a hop-by-hop header
		// in the Request's Connection header.
		const someConnHeader = "X-Some-Conn-Header"

		reqHeaders := map[string][]string{
			"Connection":        {"Upgrade, " + fakeConnectionToken, someConnHeader},
			someConnHeader:      {"should be deleted"},
			fakeConnectionToken: {"should be deleted"},
			"X-Custom":          {"should not be deleted"},
		}

		resHeaders := make(map[string][]string, len(reqHeaders))
		for k, v := range reqHeaders {
			resHeaders[k] = v
		}

		req := &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				PluginID: "pid",
			},
			Headers: reqHeaders,
		}

		responses := []*backend.CallResourceResponse{}
		sender := callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			responses = append(responses, res)
			return nil
		})

		var actualReq *backend.CallResourceRequest
		p.RegisterClient(&fakePluginBackend{
			crr: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				actualReq = req
				return sender.Send(&backend.CallResourceResponse{
					Headers: resHeaders,
					Status:  http.StatusOK,
					Body:    []byte(backendResponse),
				})
			},
		})
		err := registry.Add(context.Background(), p)
		require.NoError(t, err)

		client := ProvideService(registry, &config.Cfg{})

		err = client.CallResource(context.Background(), req, sender)
		require.NoError(t, err)

		require.NotNil(t, actualReq)
		require.Len(t, actualReq.Headers, 1)
		require.Equal(t, "should not be deleted", actualReq.Headers["X-Custom"][0])

		require.Len(t, responses, 1)
		res := responses[0]
		require.Equal(t, http.StatusOK, res.Status)
		require.Equal(t, []byte(backendResponse), res.Body)
		require.Len(t, res.Headers, 1)
		require.Equal(t, "should not be deleted", actualReq.Headers["X-Custom"][0])
	})
}

type fakePluginBackend struct {
	qdr backend.QueryDataHandlerFunc
	crr backend.CallResourceHandlerFunc

	backendplugin.Plugin
}

func (f *fakePluginBackend) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if f.qdr != nil {
		return f.qdr(ctx, req)
	}
	return backend.NewQueryDataResponse(), nil
}

func (f *fakePluginBackend) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if f.crr != nil {
		return f.crr(ctx, req, sender)
	}

	return nil
}

func (f *fakePluginBackend) IsDecommissioned() bool {
	return false
}

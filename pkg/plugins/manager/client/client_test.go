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
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/stretchr/testify/require"
)

func TestQueryData(t *testing.T) {
	t.Run("Empty registry should return not registered error", func(t *testing.T) {
		registry := fakes.NewFakePluginRegistry()
		client := ProvideService(registry)
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
				err:           plugins.ErrPluginUnavailable,
				expectedError: plugins.ErrPluginUnavailable,
			},
			{
				err:           plugins.ErrMethodNotImplemented,
				expectedError: plugins.ErrMethodNotImplemented,
			},
			{
				err:           errors.New("surprise surprise"),
				expectedError: plugins.ErrPluginRequestFailureErrorBase,
			},
			{
				err:           context.Canceled,
				expectedError: plugins.ErrPluginRequestCanceledErrorBase,
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

				client := ProvideService(registry)
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

func TestCheckHealth(t *testing.T) {
	t.Run("empty plugin registry should return plugin not registered error", func(t *testing.T) {
		registry := fakes.NewFakePluginRegistry()
		client := ProvideService(registry)
		_, err := client.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
		require.Error(t, err)
		require.ErrorIs(t, err, plugins.ErrPluginNotRegistered)
	})

	t.Run("non-empty plugin registry", func(t *testing.T) {
		tcs := []struct {
			err           error
			expectedError error
		}{
			{
				err:           plugins.ErrPluginUnavailable,
				expectedError: plugins.ErrPluginUnavailable,
			},
			{

				err:           plugins.ErrMethodNotImplemented,
				expectedError: plugins.ErrMethodNotImplemented,
			},
			{
				err:           errors.New("surprise surprise"),
				expectedError: plugins.ErrPluginHealthCheck,
			},
			{
				err:           context.Canceled,
				expectedError: plugins.ErrPluginRequestCanceledErrorBase,
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
					chr: func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
						return nil, tc.err
					},
				})
				err := registry.Add(context.Background(), p)
				require.NoError(t, err)

				client := ProvideService(registry)
				_, err = client.CheckHealth(context.Background(), &backend.CheckHealthRequest{
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
		sender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
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

		client := ProvideService(registry)

		err = client.CallResource(context.Background(), req, sender)
		require.NoError(t, err)

		require.NotNil(t, actualReq)
		require.Len(t, actualReq.Headers, 1)
		require.Equal(t, "should not be deleted", actualReq.Headers["X-Custom"][0])

		require.Len(t, responses, 1)
		res := responses[0]
		require.Equal(t, http.StatusOK, res.Status)
		require.Equal(t, []byte(backendResponse), res.Body)
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
		sender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
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

		client := ProvideService(registry)

		err = client.CallResource(context.Background(), req, sender)
		require.NoError(t, err)

		require.NotNil(t, actualReq)
		require.Len(t, actualReq.Headers, 1)
		require.Equal(t, "should not be deleted", actualReq.Headers["X-Custom"][0])

		require.Len(t, responses, 1)
		res := responses[0]
		require.Equal(t, http.StatusOK, res.Status)
		require.Equal(t, []byte(backendResponse), res.Body)
		require.Equal(t, "should not be deleted", actualReq.Headers["X-Custom"][0])
	})

	t.Run("Should remove non-allowed response headers", func(t *testing.T) {
		resHeaders := map[string][]string{
			setCookieHeaderName: {"monster"},
			"X-Custom":          {"should not be deleted"},
		}

		req := &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				PluginID: "pid",
			},
		}

		responses := []*backend.CallResourceResponse{}
		sender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			responses = append(responses, res)
			return nil
		})

		p.RegisterClient(&fakePluginBackend{
			crr: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				return sender.Send(&backend.CallResourceResponse{
					Headers: resHeaders,
					Status:  http.StatusOK,
					Body:    []byte(backendResponse),
				})
			},
		})
		err := registry.Add(context.Background(), p)
		require.NoError(t, err)

		client := ProvideService(registry)

		err = client.CallResource(context.Background(), req, sender)
		require.NoError(t, err)

		require.Len(t, responses, 1)
		res := responses[0]
		require.Equal(t, http.StatusOK, res.Status)
		require.Equal(t, []byte(backendResponse), res.Body)
		require.Empty(t, res.Headers[setCookieHeaderName])
		require.Equal(t, "should not be deleted", res.Headers["X-Custom"][0])
	})

	t.Run("Should set proxy response headers", func(t *testing.T) {
		resHeaders := map[string][]string{
			"X-Custom": {"should not be deleted"},
		}

		req := &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				PluginID: "pid",
			},
		}

		responses := []*backend.CallResourceResponse{}
		sender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			responses = append(responses, res)
			return nil
		})

		p.RegisterClient(&fakePluginBackend{
			crr: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				return sender.Send(&backend.CallResourceResponse{
					Headers: resHeaders,
					Status:  http.StatusOK,
					Body:    []byte(backendResponse),
				})
			},
		})
		err := registry.Add(context.Background(), p)
		require.NoError(t, err)

		client := ProvideService(registry)

		err = client.CallResource(context.Background(), req, sender)
		require.NoError(t, err)

		require.Len(t, responses, 1)
		res := responses[0]
		require.Equal(t, http.StatusOK, res.Status)
		require.Equal(t, []byte(backendResponse), res.Body)
		require.Equal(t, "sandbox", res.Headers["Content-Security-Policy"][0])
		require.Equal(t, "should not be deleted", res.Headers["X-Custom"][0])
	})

	t.Run("Should ensure content type header", func(t *testing.T) {
		tcs := []struct {
			contentType    string
			responseStatus int
			expContentType string
		}{
			{
				contentType:    "",
				responseStatus: http.StatusOK,
				expContentType: defaultContentType,
			},
			{
				contentType:    "text/plain",
				responseStatus: http.StatusOK,
				expContentType: "text/plain",
			},
			{
				contentType:    "",
				responseStatus: http.StatusNoContent,
				expContentType: "",
			},
		}

		for _, tc := range tcs {
			t.Run(fmt.Sprintf("content type=%s, status=%d, exp=%s", tc.contentType, tc.responseStatus, tc.expContentType), func(t *testing.T) {
				resHeaders := map[string][]string{}

				if tc.contentType != "" {
					resHeaders[contentTypeHeaderName] = []string{tc.contentType}
				}

				req := &backend.CallResourceRequest{
					PluginContext: backend.PluginContext{
						PluginID: "pid",
					},
				}

				responses := []*backend.CallResourceResponse{}
				sender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
					responses = append(responses, res)
					return nil
				})

				p.RegisterClient(&fakePluginBackend{
					crr: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
						return sender.Send(&backend.CallResourceResponse{
							Headers: resHeaders,
							Status:  tc.responseStatus,
							Body:    []byte(backendResponse),
						})
					},
				})
				err := registry.Add(context.Background(), p)
				require.NoError(t, err)

				client := ProvideService(registry)

				err = client.CallResource(context.Background(), req, sender)
				require.NoError(t, err)

				require.Len(t, responses, 1)
				res := responses[0]

				if tc.expContentType != "" {
					require.Equal(t, tc.expContentType, res.Headers[contentTypeHeaderName][0])
				} else {
					require.Empty(t, res.Headers[contentTypeHeaderName])
				}
			})
		}
	})
}

type fakePluginBackend struct {
	qdr backend.QueryDataHandlerFunc
	crr backend.CallResourceHandlerFunc
	chr backend.CheckHealthHandlerFunc

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

func (f *fakePluginBackend) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if f.chr != nil {
		return f.chr(ctx, req)
	}
	return &backend.CheckHealthResult{}, nil
}

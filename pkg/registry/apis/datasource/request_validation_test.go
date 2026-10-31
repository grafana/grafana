package datasource

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

type requestValidatorFunc func(string, map[string]any, *http.Request) error

func (f requestValidatorFunc) Validate(dsURL string, jsonData map[string]any, req *http.Request) error {
	return f(dsURL, jsonData, req)
}

func TestSubresourceRequestValidation(t *testing.T) {
	for _, endpoint := range []string{"health", "resources"} {
		for _, deny := range []bool{false, true} {
			name := endpoint + "/allowed"
			if deny {
				name = endpoint + "/denied"
			}
			t.Run(name, func(t *testing.T) {
				settings := &backend.DataSourceInstanceSettings{
					UID:      "test-ds",
					URL:      "http://datasource.example",
					JSONData: []byte(`{"enableSecureSocksProxy":true}`),
				}
				validated := false
				called := false
				builder := &DataSourceAPIBuilder{
					datasourceResourceInfo: datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("test.datasource.grafana.app", "test"),
					datasources:            &mockHealthDatasourceProvider{instanceSettings: settings},
					contextProvider:        &mockHealthContextProvider{pluginCtx: backend.PluginContext{DataSourceInstanceSettings: settings}},
					dataSourceRequestValidator: requestValidatorFunc(func(dsURL string, jsonData map[string]any, req *http.Request) error {
						validated = true
						require.Equal(t, settings.URL, dsURL)
						require.Equal(t, map[string]any{"enableSecureSocksProxy": true}, jsonData)
						require.Equal(t, "stacks-123", request.NamespaceValue(req.Context()))
						require.Equal(t, "private", req.Header.Get("X-Drop"))
						if deny {
							return errors.New("blocked")
						}
						req.Header.Del("X-Drop")
						req.Header.Set("Cookie", "keep=value")
						return nil
					}),
				}
				var connector rest.Connecter
				if endpoint == "health" {
					builder.client = mockHealthClient{checkHealthFunc: func(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
						called = true
						require.True(t, validated)
						return &backend.CheckHealthResult{Status: backend.HealthStatusOk}, nil
					}}
					connector = &subHealthREST{builder: builder}
				} else {
					builder.client = &resourceMockClient{callResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
						called = true
						require.True(t, validated)
						require.Equal(t, "stacks-123", request.NamespaceValue(ctx))
						require.Empty(t, http.Header(req.Headers).Get("X-Drop"))
						require.Equal(t, "public", http.Header(req.Headers).Get("X-Keep"))
						require.Equal(t, "keep=value", http.Header(req.Headers).Get("Cookie"))
						return sender.Send(&backend.CallResourceResponse{Status: http.StatusOK})
					}}
					connector = &subResourceREST{builder: builder}
				}
				responder := &mockHealthResponder{}
				ctx := request.WithNamespace(context.Background(), "stacks-123")
				handler, err := connector.Connect(ctx, "test-ds", nil, responder)
				require.NoError(t, err)
				// Only Connect's context contains the authenticated tenant namespace.
				req := httptest.NewRequest(http.MethodGet, "/apis/test/datasources/test-ds/"+endpoint, nil)
				req.Header.Set("X-Drop", "private")
				req.Header.Set("X-Keep", "public")
				req.Header.Set("Cookie", "drop=secret; keep=value")
				handler.ServeHTTP(httptest.NewRecorder(), req)

				require.True(t, validated)
				require.Equal(t, !deny, called)
				if deny {
					require.True(t, apierrors.IsForbidden(responder.err), "expected forbidden, got %v", responder.err)
				} else {
					require.NoError(t, responder.err)
				}
			})
		}
	}
}

package datasource

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestSubQueryConvertConnect(t *testing.T) {
	originReq := `{"from":"","to":"","queries":[{"refId":"A","datasource":{"type":"","uid":"dsuid"},"rawSql":"SELECT * FROM table"}]}`
	converted := `{"refId":"A","datasource":{"type":"","uid":"dsuid"},"SQL":"SELECT * FROM table"}`
	convertedReq := `{"from":"","to":"","queries":[` + converted + `]}`

	sqr := queryConvertREST{
		client: mockConvertClient{
			t:             t,
			expectedInput: backend.RawObject{Raw: []byte(originReq), ContentType: "application/json"},
			convertObject: backend.RawObject{Raw: []byte(converted), ContentType: "application/json"},
		},
		contextProvider: mockContextProvider{},
	}
	rr := httptest.NewRecorder()
	mr := &mockResponderConvert{
		writer: rr,
	}
	handler, err := sqr.Connect(context.Background(), "name", nil, mr)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/", bytes.NewReader([]byte(originReq)))
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	require.Contains(t, rr.Body.String(), convertedReq)
}

type conversionContextFunc func(context.Context, *backend.DataSourceInstanceSettings) (backend.PluginContext, error)

func (f conversionContextFunc) PluginContextForDataSource(ctx context.Context, settings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return f(ctx, settings)
}

func TestConvertQueryDataRequestDatasourceReferences(t *testing.T) {
	const first = `{"refId":"A","datasource":{"type":"prometheus","uid":"ds"}}`
	const second = `{"refId":"B","datasource":{"type":"prometheus","uid":"ds"}}`
	for _, tc := range []struct {
		name    string
		queries string
		valid   bool
	}{
		{name: "same datasource", queries: first + "," + second, valid: true},
		{name: "mixed types", queries: first + "," + strings.ReplaceAll(second, "prometheus", "loki")},
		{name: "mixed UIDs", queries: first + "," + strings.ReplaceAll(second, `"uid":"ds"`, `"uid":"other"`)},
		{name: "missing later reference", queries: first + `,{"refId":"B"}`},
		{name: "missing first reference", queries: `{"refId":"A"},` + second},
		{name: "empty queries"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			contextCalls, conversionCalls := 0, 0
			provider := conversionContextFunc(func(_ context.Context, settings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
				contextCalls++
				require.Equal(t, "prometheus", settings.Type)
				require.Equal(t, "ds", settings.UID)
				return backend.PluginContext{
					DataSourceInstanceSettings: settings,
					GrafanaConfig:              config.NewGrafanaCfg(map[string]string{}),
				}, nil
			})
			body := `{"queries":[` + tc.queries + `]}`
			client := httpConversionFunc(func(_ context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
				conversionCalls++
				require.Len(t, req.Objects, 1)
				require.JSONEq(t, body, string(req.Objects[0].Raw))
				return &backend.ConversionResponse{Objects: []backend.RawObject{
					{Raw: []byte(first), ContentType: "application/json"},
					{Raw: []byte(second), ContentType: "application/json"},
				}}, nil
			})
			req := httptest.NewRequest(http.MethodPost, "/queryconvert", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			result, err := convertQueryDataRequest(req.Context(), req, client, provider)
			if tc.valid {
				require.NoError(t, err)
				require.Len(t, result.Queries, 2)
				require.Equal(t, 1, contextCalls)
				require.Equal(t, 1, conversionCalls)
			} else {
				require.True(t, apierrors.IsBadRequest(err), "%v", err)
				require.Nil(t, result)
				require.Zero(t, contextCalls)
				require.Zero(t, conversionCalls)
			}
		})
	}
}

type mockConvertClient struct {
	t             *testing.T
	expectedInput backend.RawObject
	convertObject backend.RawObject
}

func (m mockConvertClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, nil
}

func (m mockConvertClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return nil
}

func (m mockConvertClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, nil
}

func (m mockConvertClient) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	require.Equal(m.t, string(m.expectedInput.Raw), string(req.Objects[0].Raw))
	return &backend.ConversionResponse{
		Objects: []backend.RawObject{m.convertObject},
	}, nil
}

type mockResponderConvert struct {
	writer http.ResponseWriter
}

// Object writes the provided object to the response. Invoking this method multiple times is undefined.
func (m mockResponderConvert) Object(statusCode int, obj runtime.Object) {
	m.writer.WriteHeader(statusCode)
	err := json.NewEncoder(m.writer).Encode(obj)
	if err != nil {
		panic(err)
	}
}

// Error writes the provided error to the response. This method may only be invoked once.
func (m mockResponderConvert) Error(err error) {
	m.writer.WriteHeader(http.StatusInternalServerError)
	errStr := err.Error()
	_, err = m.writer.Write([]byte(errStr))
	if err != nil {
		panic(err)
	}
}

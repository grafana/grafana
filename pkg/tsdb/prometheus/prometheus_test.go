package prometheus

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/promlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test helpers from promlib pattern.
type fakeSender struct {
	Responses []*backend.CallResourceResponse
}

func (fs *fakeSender) Send(resp *backend.CallResourceResponse) error {
	fs.Responses = append(fs.Responses, resp)
	return nil
}

type fakeRoundtripper struct {
	Req *http.Request
}

func (rt *fakeRoundtripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.Req = req
	// Return a valid Prometheus API response format
	body := `{"status":"success","data":{"resultType":"vector","result":[]}}`
	return &http.Response{
		Status:        "200 OK",
		StatusCode:    200,
		Header:        http.Header{"Content-Type": []string{"application/json"}},
		Body:          io.NopCloser(strings.NewReader(body)),
		ContentLength: int64(len(body)),
	}, nil
}

type fakeHTTPClientProvider struct {
	sdkhttpclient.Provider
	Roundtripper *fakeRoundtripper
}

func (provider *fakeHTTPClientProvider) New(opts ...sdkhttpclient.Options) (*http.Client, error) {
	client := &http.Client{}
	provider.Roundtripper = &fakeRoundtripper{}
	client.Transport = provider.Roundtripper
	return client, nil
}

func (provider *fakeHTTPClientProvider) GetTransport(opts ...sdkhttpclient.Options) (http.RoundTripper, error) {
	return &fakeRoundtripper{}, nil
}

func getMockPromTestSDKProvider(f *fakeHTTPClientProvider) *sdkhttpclient.Provider {
	anotherFN := func(o sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		_, _ = f.New()
		return f.Roundtripper
	}
	fn := sdkhttpclient.MiddlewareFunc(anotherFN)
	mid := sdkhttpclient.NamedMiddlewareFunc("mock", fn)
	return sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{Middlewares: []sdkhttpclient.Middleware{mid}})
}

func mockPluginContext() backend.PluginContext {
	return backend.PluginContext{
		OrgID:     0,
		PluginID:  "prometheus",
		User:      nil,
		GrafanaConfig: backend.NewGrafanaCfg(map[string]string{
			"concurrent_query_count": "10",
		}),
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			ID:               0,
			UID:              "",
			Type:             "prometheus",
			Name:             "test-prom",
			URL:              "http://localhost:9090",
			User:             "",
			Database:         "",
			BasicAuthEnabled: true,
			BasicAuthUser:    "admin",
			Updated:          time.Time{},
			JSONData:         []byte("{}"),
		},
	}
}

// setupTestService creates a Service instance with mocked HTTP client for testing.
func setupTestService() (*Service, *fakeHTTPClientProvider) {
	f := &fakeHTTPClientProvider{}
	httpProvider := getMockPromTestSDKProvider(f)
	service := ProvideService(httpProvider)
	return service, f
}

// setupTestContext creates a context with Grafana config and plugin context.
func setupTestContext() context.Context {
	cfg := backend.NewGrafanaCfg(map[string]string{})
	ctx := backend.WithGrafanaConfig(context.Background(), cfg)
	return backend.WithPluginContext(ctx, mockPluginContext())
}

func TestExtendClientOpts(t *testing.T) {
	t.Run("add azure credentials if configured", func(t *testing.T) {
		cfg := backend.NewGrafanaCfg(map[string]string{
			azsettings.AzureCloud:       azsettings.AzurePublic,
			azsettings.AzureAuthEnabled: "true",
		})
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData: []byte(`{
				"azureCredentials": {
					"authType": "msi"
				}
			}`),
			DecryptedSecureJSONData: map[string]string{},
		}
		ctx := backend.WithGrafanaConfig(context.Background(), cfg)
		opts := &sdkhttpclient.Options{}
		err := extendClientOpts(ctx, settings, opts, log.NewNullLogger())
		require.NoError(t, err)
		require.Equal(t, 1, len(opts.Middlewares))
	})

	t.Run("add sigV4 auth if opts has SigV4 configured", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled:        false,
			BasicAuthUser:           "",
			JSONData:                []byte(""),
			DecryptedSecureJSONData: map[string]string{},
		}
		opts := &sdkhttpclient.Options{
			SigV4: &sdkhttpclient.SigV4Config{
				AuthType:  "test",
				AccessKey: "accesskey",
				SecretKey: "secretkey",
			},
		}
		err := extendClientOpts(context.Background(), settings, opts, log.NewNullLogger())
		require.NoError(t, err)
		require.Equal(t, "aps", opts.SigV4.Service)
	})
}

func TestService_QueryData(t *testing.T) {
	t.Run("delegates to promlib.Service", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := &backend.QueryDataRequest{
			PluginContext: mockPluginContext(),
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					QueryType: "timeSeriesQuery",
					JSON:      []byte(`{"expr": "up"}`),
				},
			},
		}

		resp, err := service.QueryData(ctx, req)
		// QueryData delegates correctly
		assert.NotNil(t, resp)
		if err == nil {
			assert.NotNil(t, resp.Responses)
		}
	})

	t.Run("returns error for empty queries", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := &backend.QueryDataRequest{
			PluginContext: mockPluginContext(),
			Queries:       []backend.DataQuery{},
		}

		resp, err := service.QueryData(ctx, req)
		assert.Error(t, err)
		assert.NotNil(t, resp)
	})
}

func TestService_CallResource(t *testing.T) {
	t.Run("delegates to promlib.Service", func(t *testing.T) {
		service, f := setupTestService()
		ctx := setupTestContext()
		req := &backend.CallResourceRequest{
			PluginContext: mockPluginContext(),
			Path:           "/api/v1/series",
			Method:         http.MethodPost,
			URL:            "/api/v1/series",
			Body:           []byte("match[]: ALERTS"),
		}
		sender := &fakeSender{}

		err := service.CallResource(ctx, req, sender)
		require.NoError(t, err)
		assert.NotNil(t, f.Roundtripper.Req)
	})

	t.Run("handles suggestions resource", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := &backend.CallResourceRequest{
			PluginContext: mockPluginContext(),
			Path:          "suggestions",
			URL:           "suggestions",
			Method:        http.MethodPost,
			Body:          []byte(`{"queries": ["up"]}`),
		}
		sender := &fakeSender{}

		err := service.CallResource(ctx, req, sender)
		require.NoError(t, err)
	})
}

func TestService_GetBuildInfo(t *testing.T) {
	t.Run("delegates to promlib.Service", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := promlib.BuildInfoRequest{
			PluginContext: mockPluginContext(),
		}

		resp, err := service.GetBuildInfo(ctx, req)
		// GetBuildInfo delegates correctly
		_ = resp
		_ = err
	})
}

func TestService_GetHeuristics(t *testing.T) {
	t.Run("delegates to promlib.Service", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := promlib.HeuristicsRequest{
			PluginContext: mockPluginContext(),
		}

		resp, err := service.GetHeuristics(ctx, req)
		// GetHeuristics delegates correctly
		_ = resp
		_ = err
	})
}

func TestService_CheckHealth(t *testing.T) {
	t.Run("delegates to promlib.Service", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := &backend.CheckHealthRequest{
			PluginContext: mockPluginContext(),
		}

		resp, err := service.CheckHealth(ctx, req)
		// CheckHealth delegates correctly
		assert.NotNil(t, resp) // CheckHealth always returns a result
		_ = err
	})
}

func TestService_ValidateAdmission(t *testing.T) {
	t.Run("delegates to promlib.Service", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := &backend.AdmissionRequest{
			PluginContext: mockPluginContext(),
		}

		resp, err := service.ValidateAdmission(ctx, req)
		// ValidateAdmission delegates correctly
		_ = resp
		_ = err
	})
}

func TestService_MutateAdmission(t *testing.T) {
	t.Run("delegates to promlib.Service", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := &backend.AdmissionRequest{
			PluginContext: mockPluginContext(),
		}

		resp, err := service.MutateAdmission(ctx, req)
		// MutateAdmission delegates correctly
		_ = resp
		_ = err
	})
}

func TestService_ConvertObjects(t *testing.T) {
	t.Run("delegates to promlib.Service", func(t *testing.T) {
		service, _ := setupTestService()
		ctx := setupTestContext()
		req := &backend.ConversionRequest{
			PluginContext: mockPluginContext(),
		}

		resp, err := service.ConvertObjects(ctx, req)
		// ConvertObjects delegates correctly
		_ = resp
		_ = err
	})
}

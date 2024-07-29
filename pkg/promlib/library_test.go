package promlib

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/require"
)

type fakeSender struct{}

func (sender *fakeSender) Send(resp *backend.CallResourceResponse) error {
	return nil
}

type fakeRoundtripper struct {
	Req *http.Request
}

func (rt *fakeRoundtripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.Req = req
	return &http.Response{
		Status:        "200",
		StatusCode:    200,
		Header:        nil,
		Body:          nil,
		ContentLength: 0,
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

func mockExtendTransportOptions(ctx context.Context, settings backend.DataSourceInstanceSettings, clientOpts *sdkhttpclient.Options, log log.Logger) error {
	return nil
}

func TestService(t *testing.T) {
	t.Run("Service", func(t *testing.T) {
		t.Run("CallResource", func(t *testing.T) {
			t.Run("creates correct request", func(t *testing.T) {
				f := &fakeHTTPClientProvider{}
				httpProvider := getMockPromTestSDKProvider(f)
				service := NewService(httpProvider, backend.NewLoggerWith("logger", "test"), mockExtendTransportOptions)

				req := mockRequest()
				sender := &fakeSender{}
				err := service.CallResource(context.Background(), req, sender)
				require.NoError(t, err)
				require.Equal(
					t,
					http.Header{
						"Content-Type":    {"application/x-www-form-urlencoded"},
						"Idempotency-Key": []string(nil),
					},
					f.Roundtripper.Req.Header)
				require.Equal(t, http.MethodPost, f.Roundtripper.Req.Method)
				body, err := io.ReadAll(f.Roundtripper.Req.Body)
				require.NoError(t, err)
				require.Equal(t, []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"), body)
				require.Equal(t, "http://localhost:9090/api/v1/series", f.Roundtripper.Req.URL.String())
			})
		})
	})

	t.Run("no extendOptions function provided", func(t *testing.T) {
		f := &fakeHTTPClientProvider{}
		httpProvider := getMockPromTestSDKProvider(f)
		service := NewService(httpProvider, backend.NewLoggerWith("logger", "test"), nil)
		require.NotNil(t, service)
		require.NotNil(t, service.im)
	})

	t.Run("extendOptions function provided", func(t *testing.T) {
		f := &fakeHTTPClientProvider{}
		httpProvider := getMockPromTestSDKProvider(f)
		service := NewService(httpProvider, backend.NewLoggerWith("logger", "test"), func(ctx context.Context, settings backend.DataSourceInstanceSettings, clientOpts *sdkhttpclient.Options, log log.Logger) error {
			fmt.Println(ctx, settings, clientOpts)
			require.NotNil(t, ctx)
			require.NotNil(t, settings)
			require.Equal(t, "test-prom", settings.Name)
			return nil
		})

		req := mockRequest()
		sender := &fakeSender{}
		err := service.CallResource(context.Background(), req, sender)
		require.NoError(t, err)
	})
}

func mockRequest() *backend.CallResourceRequest {
	return &backend.CallResourceRequest{
		PluginContext: backend.PluginContext{
			OrgID:               0,
			PluginID:            "prometheus",
			User:                nil,
			AppInstanceSettings: nil,
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
		},
		Path:   "/api/v1/series",
		Method: http.MethodPost,
		URL:    "/api/v1/series",
		Body:   []byte("match%5B%5D: ALERTS\nstart: 1655271408\nend: 1655293008"),
	}
}

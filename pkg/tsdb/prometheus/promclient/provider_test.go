package promclient_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/promclient"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"

	"github.com/stretchr/testify/require"
)

var headers = map[string]string{"Authorization": "token", "X-ID-Token": "id-token"}

func TestGetClient(t *testing.T) {
	t.Run("it sets the SigV4 service if it exists", func(t *testing.T) {
		tc := setup(`{"sigV4Auth":true}`)

		setting.SigV4AuthEnabled = true
		defer func() { setting.SigV4AuthEnabled = false }()

		_, err := tc.promClientProvider.GetClient(headers)
		require.Nil(t, err)

		require.Equal(t, "aps", tc.httpProvider.opts.SigV4.Service)
	})

	t.Run("it always uses the custom params and custom headers middlewares", func(t *testing.T) {
		tc := setup()

		_, err := tc.promClientProvider.GetClient(headers)
		require.Nil(t, err)

		require.Len(t, tc.httpProvider.middlewares(), 2)
		require.Contains(t, tc.httpProvider.middlewares(), "prom-custom-query-parameters")
		require.Contains(t, tc.httpProvider.middlewares(), "CustomHeaders")
	})

	t.Run("extra headers", func(t *testing.T) {
		t.Run("it sets the headers when 'oauthPassThru' is true and auth headers are passed", func(t *testing.T) {
			tc := setup(`{"oauthPassThru":true}`)
			_, err := tc.promClientProvider.GetClient(headers)
			require.Nil(t, err)

			require.Equal(t, headers, tc.httpProvider.opts.Headers)
		})

		t.Run("it sets all headers", func(t *testing.T) {
			withNonAuth := map[string]string{"X-Not-Auth": "stuff"}

			tc := setup(`{"oauthPassThru":true}`)
			_, err := tc.promClientProvider.GetClient(withNonAuth)
			require.Nil(t, err)

			require.Equal(t, map[string]string{"X-Not-Auth": "stuff"}, tc.httpProvider.opts.Headers)
		})

		t.Run("it does not error when headers are nil", func(t *testing.T) {
			tc := setup(`{"oauthPassThru":true}`)

			_, err := tc.promClientProvider.GetClient(nil)
			require.Nil(t, err)
		})
	})

	t.Run("force get middleware", func(t *testing.T) {
		t.Run("it add the force-get middleware when httpMethod is get", func(t *testing.T) {
			tc := setup(`{"httpMethod":"get"}`)

			_, err := tc.promClientProvider.GetClient(headers)
			require.Nil(t, err)

			require.Len(t, tc.httpProvider.middlewares(), 3)
			require.Contains(t, tc.httpProvider.middlewares(), "force-http-get")
		})

		t.Run("it add the force-get middleware when httpMethod is get", func(t *testing.T) {
			tc := setup(`{"httpMethod":"GET"}`)

			_, err := tc.promClientProvider.GetClient(headers)
			require.Nil(t, err)

			require.Len(t, tc.httpProvider.middlewares(), 3)
			require.Contains(t, tc.httpProvider.middlewares(), "force-http-get")
		})

		t.Run("it does not add the force-get middleware when httpMethod is POST", func(t *testing.T) {
			tc := setup(`{"httpMethod":"POST"}`)

			_, err := tc.promClientProvider.GetClient(headers)
			require.Nil(t, err)

			require.NotContains(t, tc.httpProvider.middlewares(), "force-http-get")
		})

		t.Run("it does not add the force-get middleware when json data is nil", func(t *testing.T) {
			tc := setup()

			_, err := tc.promClientProvider.GetClient(headers)
			require.Nil(t, err)

			require.NotContains(t, tc.httpProvider.middlewares(), "force-http-get")
		})

		t.Run("it does not add the force-get middleware when json data is empty", func(t *testing.T) {
			tc := setup(`{}`)

			_, err := tc.promClientProvider.GetClient(headers)
			require.Nil(t, err)

			require.NotContains(t, tc.httpProvider.middlewares(), "force-http-get")
		})

		t.Run("it does not add the force-get middleware httpMethod is null", func(t *testing.T) {
			tc := setup(`{"httpMethod":null}`)

			_, err := tc.promClientProvider.GetClient(headers)
			require.Nil(t, err)

			require.NotContains(t, tc.httpProvider.middlewares(), "force-http-get")
		})
	})
}

func setup(jsonData ...string) *testContext {
	var rawData []byte
	if len(jsonData) > 0 {
		rawData = []byte(jsonData[0])
	}

	var jd map[string]interface{}
	_ = json.Unmarshal(rawData, &jd)

	cfg := &setting.Cfg{}
	settings := backend.DataSourceInstanceSettings{URL: "test-url", JSONData: rawData}
	features := featuremgmt.WithFeatures()
	hp := &fakeHttpClientProvider{}
	p := promclient.NewProvider(settings, jd, hp, cfg, features, nil)

	return &testContext{
		httpProvider:       hp,
		promClientProvider: p,
	}
}

type testContext struct {
	httpProvider       *fakeHttpClientProvider
	promClientProvider *promclient.Provider
}

type fakeHttpClientProvider struct {
	httpclient.Provider

	opts sdkhttpclient.Options
}

func (p *fakeHttpClientProvider) GetTransport(opts ...sdkhttpclient.Options) (http.RoundTripper, error) {
	p.opts = opts[0]
	return http.DefaultTransport, nil
}

func (p *fakeHttpClientProvider) middlewares() []string {
	var middlewareNames []string
	for _, m := range p.opts.Middlewares {
		mw, ok := m.(sdkhttpclient.MiddlewareName)
		if !ok {
			panic("unexpected middleware type")
		}

		middlewareNames = append(middlewareNames, mw.MiddlewareName())
	}
	return middlewareNames
}

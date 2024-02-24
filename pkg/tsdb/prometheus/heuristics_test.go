package prometheus

import (
	"context"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

type heuristicsSuccessRoundTripper struct {
	res    io.ReadCloser
	status int
}

func (rt *heuristicsSuccessRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		Status:        strconv.Itoa(rt.status),
		StatusCode:    rt.status,
		Header:        nil,
		Body:          rt.res,
		ContentLength: 0,
		Request:       req,
	}, nil
}

func newHeuristicsSDKProvider(hrt heuristicsSuccessRoundTripper) *httpclient.Provider {
	anotherFN := func(o httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return &hrt
	}
	fn := httpclient.MiddlewareFunc(anotherFN)
	mid := httpclient.NamedMiddlewareFunc("mock", fn)
	return httpclient.NewProvider(httpclient.ProviderOptions{Middlewares: []httpclient.Middleware{mid}})
}

func Test_GetHeuristics(t *testing.T) {
	t.Run("should return Prometheus", func(t *testing.T) {
		rt := heuristicsSuccessRoundTripper{
			res:    io.NopCloser(strings.NewReader("{\"status\":\"success\",\"data\":{\"version\":\"1.0\"}}")),
			status: http.StatusOK,
		}
		//httpProvider := getHeuristicsMockProvider(&rt)
		httpProvider := newHeuristicsSDKProvider(rt)
		s := &Service{
			im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, backend.NewLoggerWith("logger", "test"))),
		}

		req := HeuristicsRequest{
			PluginContext: getPluginContext(),
		}
		res, err := s.GetHeuristics(context.Background(), req)
		assert.NoError(t, err)
		require.NotNil(t, res)
		assert.Equal(t, KindPrometheus, res.Application)
		assert.Equal(t, Features{RulerApiEnabled: false}, res.Features)
	})

	t.Run("should return Mimir", func(t *testing.T) {
		rt := heuristicsSuccessRoundTripper{
			res:    io.NopCloser(strings.NewReader("{\"status\":\"success\",\"data\":{\"features\":{\"foo\":\"bar\"},\"version\":\"1.0\"}}")),
			status: http.StatusOK,
		}
		httpProvider := newHeuristicsSDKProvider(rt)
		s := &Service{
			im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, backend.NewLoggerWith("logger", "test"))),
		}

		req := HeuristicsRequest{
			PluginContext: getPluginContext(),
		}
		res, err := s.GetHeuristics(context.Background(), req)
		assert.NoError(t, err)
		require.NotNil(t, res)
		assert.Equal(t, KindMimir, res.Application)
		assert.Equal(t, Features{RulerApiEnabled: true}, res.Features)
	})
}

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

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkHttpClient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type heuristicsProvider struct {
	httpclient.Provider
	http.RoundTripper
}

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

func (provider *heuristicsProvider) New(opts ...sdkHttpClient.Options) (*http.Client, error) {
	client := &http.Client{}
	client.Transport = provider.RoundTripper
	return client, nil
}

func (provider *heuristicsProvider) GetTransport(opts ...sdkHttpClient.Options) (http.RoundTripper, error) {
	return provider.RoundTripper, nil
}

func getHeuristicsMockProvider(rt http.RoundTripper) *heuristicsProvider {
	return &heuristicsProvider{
		RoundTripper: rt,
	}
}

func Test_GetHeuristics(t *testing.T) {
	t.Run("should return Prometheus", func(t *testing.T) {
		rt := heuristicsSuccessRoundTripper{
			res:    io.NopCloser(strings.NewReader("{\"status\":\"success\",\"data\":{\"version\":\"1.0\"}}")),
			status: http.StatusOK,
		}
		httpProvider := getHeuristicsMockProvider(&rt)
		s := &Service{
			im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, &setting.Cfg{}, &featuremgmt.FeatureManager{}, nil)),
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
		httpProvider := getHeuristicsMockProvider(&rt)
		s := &Service{
			im: datasource.NewInstanceManager(newInstanceSettings(httpProvider, &setting.Cfg{}, &featuremgmt.FeatureManager{}, nil)),
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

package api

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
)

func TestLotexRuler_ValidateAndGetPrefix(t *testing.T) {
	tc := []struct {
		name            string
		namedParams     map[string]string
		urlParams       string
		datasourceCache datasources.CacheService
		expected        string
		err             error
	}{
		{
			name:        "with an empty datasource UID",
			namedParams: map[string]string{":DatasourceUID": ""},
			err:         errors.New("datasource UID is invalid"),
		},
		{
			name:            "with an error while trying to fetch the datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{err: datasources.ErrDataSourceNotFound},
			err:             errors.New("data source not found"),
		},
		{
			name:            "with an empty datasource URL",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{}},
			err:             errors.New("URL for this data source is empty"),
		},
		{
			name:            "with an unsupported datasource type",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: "unsupported-type"}},
			err:             errors.New("unexpected datasource type 'unsupported-type', expected loki, prometheus, amazon prometheus, azure prometheus"),
		},
		{
			name:            "with a Loki datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: datasources.DS_LOKI}},
			expected:        "/api/prom/rules",
		},
		{
			name:            "with a Prometheus datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: datasources.DS_PROMETHEUS}},
			expected:        "/rules",
		},
		{
			name:            "with an Amazon Prometheus datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://amp.com", Type: datasources.DS_AMAZON_PROMETHEUS}},
			expected:        "/rules",
		},
		{
			name:            "with an Azure Prometheus datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://azp.com", Type: datasources.DS_AZURE_PROMETHEUS}},
			expected:        "/rules",
		},
		{
			name:            "with a Prometheus datasource and subtype of Cortex",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			urlParams:       "?subtype=cortex",
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: datasources.DS_PROMETHEUS}},
			expected:        "/rules",
		},
		{
			name:            "with a Prometheus datasource and subtype of Mimir",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			urlParams:       "?subtype=mimir",
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: datasources.DS_PROMETHEUS}},
			expected:        "/config/v1/rules",
		},
		{
			name:            "with a Prometheus datasource and subtype of Prometheus",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			urlParams:       "?subtype=prometheus",
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: datasources.DS_PROMETHEUS}},
			expected:        "/rules",
		},
		{
			name:            "with a Prometheus datasource and no subtype",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: datasources.DS_PROMETHEUS}},
			expected:        "/rules",
		},
		{
			name:            "with an Amazon Prometheus datasource and subtype of Mimir",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			urlParams:       "?subtype=mimir",
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://amp.com", Type: datasources.DS_AMAZON_PROMETHEUS}},
			expected:        "/config/v1/rules",
		},
		{
			name:            "with an Azure Prometheus datasource and subtype of Mimir",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			urlParams:       "?subtype=mimir",
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://azp.com", Type: datasources.DS_AZURE_PROMETHEUS}},
			expected:        "/config/v1/rules",
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			// Setup Proxy.
			proxy := &AlertingProxy{DataProxy: &datasourceproxy.DataSourceProxyService{DataSourceCache: tt.datasourceCache}}
			ruler := &LotexRuler{AlertingProxy: proxy, log: log.NewNopLogger()}

			// Setup request context.
			httpReq, err := http.NewRequest(http.MethodGet, "http://grafanacloud.com"+tt.urlParams, nil)
			require.NoError(t, err)
			ctx := &contextmodel.ReqContext{Context: &web.Context{Req: web.SetURLParams(httpReq, tt.namedParams)}}

			prefix, err := ruler.validateAndGetPrefix(ctx)
			require.Equal(t, tt.expected, prefix)
			if tt.err != nil {
				require.EqualError(t, err, tt.err.Error())
			}
		})
	}
}

type fakeCacheService struct {
	datasource *datasources.DataSource
	err        error
}

func (f fakeCacheService) GetDatasource(_ context.Context, datasourceID int64, _ identity.Requester, _ bool) (*datasources.DataSource, error) {
	if f.err != nil {
		return nil, f.err
	}

	return f.datasource, nil
}

func (f fakeCacheService) GetDatasourceByUID(ctx context.Context, datasourceUID string, _ identity.Requester, skipCache bool) (*datasources.DataSource, error) {
	if f.err != nil {
		return nil, f.err
	}

	return f.datasource, nil
}

func TestLotexRuler_RouteDeleteNamespaceRulesConfig(t *testing.T) {
	tc := []struct {
		name        string
		namespace   string
		expected    string
		urlParams   string
		namedParams map[string]string
		datasource  *datasources.DataSource
	}{
		{
			name:        "with a namespace that has to be escaped",
			namespace:   "namespace/with/slashes",
			expected:    "http://mimir.com/config/v1/rules/namespace%2Fwith%2Fslashes?subtype=mimir",
			urlParams:   "?subtype=mimir",
			namedParams: map[string]string{":DatasourceUID": "d164"},
			datasource:  &datasources.DataSource{URL: "http://mimir.com", Type: datasources.DS_PROMETHEUS},
		},
		{
			name:        "with a namespace that does not need to be escaped",
			namespace:   "namespace_without_slashes",
			expected:    "http://mimir.com/config/v1/rules/namespace_without_slashes?subtype=mimir",
			urlParams:   "?subtype=mimir",
			namedParams: map[string]string{":DatasourceUID": "d164"},
			datasource:  &datasources.DataSource{URL: "http://mimir.com", Type: datasources.DS_PROMETHEUS},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			requestMock := RequestMock{}
			defer requestMock.AssertExpectations(t)

			requestMock.On(
				"withReq",
				mock.Anything,
				mock.Anything,
				mock.AnythingOfType("*url.URL"),
				mock.Anything,
				mock.Anything,
				mock.Anything,
			).Return(response.Empty(200)).Run(func(args mock.Arguments) {
				// Validate that the full url as string is equal to the expected value
				require.Equal(t, tt.expected, args.Get(2).(*url.URL).String())
			})

			// Setup Proxy.
			proxy := &AlertingProxy{DataProxy: &datasourceproxy.DataSourceProxyService{DataSourceCache: fakeCacheService{datasource: tt.datasource}}}
			ruler := &LotexRuler{AlertingProxy: proxy, log: log.NewNopLogger(), requester: &requestMock}

			// Setup request context.
			httpReq, err := http.NewRequest(http.MethodGet, tt.datasource.URL+tt.urlParams, nil)
			require.NoError(t, err)
			ctx := &contextmodel.ReqContext{Context: &web.Context{Req: web.SetURLParams(httpReq, tt.namedParams)}}

			ruler.RouteDeleteNamespaceRulesConfig(ctx, tt.namespace)
		})
	}
}

func TestLotexRuler_RouteDeleteRuleGroupConfig(t *testing.T) {
	tc := []struct {
		name        string
		namespace   string
		group       string
		expected    string
		urlParams   string
		namedParams map[string]string
		datasource  *datasources.DataSource
	}{
		{
			name:        "with a namespace that has to be escaped",
			namespace:   "namespace/with/slashes",
			group:       "group/with/slashes",
			expected:    "http://mimir.com/config/v1/rules/namespace%2Fwith%2Fslashes/group%2Fwith%2Fslashes?subtype=mimir",
			urlParams:   "?subtype=mimir",
			namedParams: map[string]string{":DatasourceUID": "d164"},
			datasource:  &datasources.DataSource{URL: "http://mimir.com", Type: datasources.DS_PROMETHEUS},
		},
		{
			name:        "with a namespace that does not need to be escaped",
			namespace:   "namespace_without_slashes",
			group:       "group_without_slashes",
			expected:    "http://mimir.com/config/v1/rules/namespace_without_slashes/group_without_slashes?subtype=mimir",
			urlParams:   "?subtype=mimir",
			namedParams: map[string]string{":DatasourceUID": "d164"},
			datasource:  &datasources.DataSource{URL: "http://mimir.com", Type: datasources.DS_PROMETHEUS},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			requestMock := RequestMock{}
			defer requestMock.AssertExpectations(t)

			requestMock.On(
				"withReq",
				mock.Anything,
				mock.Anything,
				mock.AnythingOfType("*url.URL"),
				mock.Anything,
				mock.Anything,
				mock.Anything,
			).Return(response.Empty(200)).Run(func(args mock.Arguments) {
				// Validate that the full url as string is equal to the expected value
				require.Equal(t, tt.expected, args.Get(2).(*url.URL).String())
			})

			// Setup Proxy.
			proxy := &AlertingProxy{DataProxy: &datasourceproxy.DataSourceProxyService{DataSourceCache: fakeCacheService{datasource: tt.datasource}}}
			ruler := &LotexRuler{AlertingProxy: proxy, log: log.NewNopLogger(), requester: &requestMock}

			// Setup request context.
			httpReq, err := http.NewRequest(http.MethodGet, tt.datasource.URL+tt.urlParams, nil)
			require.NoError(t, err)
			ctx := &contextmodel.ReqContext{Context: &web.Context{Req: web.SetURLParams(httpReq, tt.namedParams)}}

			ruler.RouteDeleteRuleGroupConfig(ctx, tt.namespace, tt.group)
		})
	}
}

func TestLotexRuler_RouteGetNamespaceRulesConfig(t *testing.T) {
	tc := []struct {
		name        string
		namespace   string
		group       string
		expected    string
		urlParams   string
		namedParams map[string]string
		datasource  *datasources.DataSource
	}{
		{
			name:        "with a namespace that has to be escaped",
			namespace:   "namespace/with/slashes",
			expected:    "http://mimir.com/config/v1/rules/namespace%2Fwith%2Fslashes?subtype=mimir",
			urlParams:   "?subtype=mimir",
			namedParams: map[string]string{":DatasourceUID": "d164"},
			datasource:  &datasources.DataSource{URL: "http://mimir.com", Type: datasources.DS_PROMETHEUS},
		},
		{
			name:        "with a namespace that does not need to be escaped",
			namespace:   "namespace_without_slashes",
			expected:    "http://mimir.com/config/v1/rules/namespace_without_slashes?subtype=mimir",
			urlParams:   "?subtype=mimir",
			namedParams: map[string]string{":DatasourceUID": "d164"},
			datasource:  &datasources.DataSource{URL: "http://mimir.com", Type: datasources.DS_PROMETHEUS},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			requestMock := RequestMock{}
			defer requestMock.AssertExpectations(t)

			requestMock.On(
				"withReq",
				mock.Anything,
				mock.Anything,
				mock.AnythingOfType("*url.URL"),
				mock.Anything,
				mock.Anything,
				mock.Anything,
			).Return(response.Empty(200)).Run(func(args mock.Arguments) {
				// Validate that the full url as string is equal to the expected value
				require.Equal(t, tt.expected, args.Get(2).(*url.URL).String())
			})

			// Setup Proxy.
			proxy := &AlertingProxy{DataProxy: &datasourceproxy.DataSourceProxyService{DataSourceCache: fakeCacheService{datasource: tt.datasource}}}
			ruler := &LotexRuler{AlertingProxy: proxy, log: log.NewNopLogger(), requester: &requestMock}

			// Setup request context.
			httpReq, err := http.NewRequest(http.MethodGet, tt.datasource.URL+tt.urlParams, nil)
			require.NoError(t, err)
			ctx := &contextmodel.ReqContext{Context: &web.Context{Req: web.SetURLParams(httpReq, tt.namedParams)}}

			ruler.RouteGetNamespaceRulesConfig(ctx, tt.namespace)
		})
	}
}

func TestLotexRuler_RouteGetRulegGroupConfig(t *testing.T) {
	tc := []struct {
		name        string
		namespace   string
		group       string
		expected    string
		urlParams   string
		namedParams map[string]string
		datasource  *datasources.DataSource
	}{
		{
			name:        "with a namespace that has to be escaped",
			namespace:   "namespace/with/slashes",
			group:       "group/with/slashes",
			expected:    "http://mimir.com/config/v1/rules/namespace%2Fwith%2Fslashes/group%2Fwith%2Fslashes?subtype=mimir",
			urlParams:   "?subtype=mimir",
			namedParams: map[string]string{":DatasourceUID": "d164"},
			datasource:  &datasources.DataSource{URL: "http://mimir.com", Type: datasources.DS_PROMETHEUS},
		},
		{
			name:        "with a namespace that does not need to be escaped",
			namespace:   "namespace_without_slashes",
			group:       "group_without_slashes",
			expected:    "http://mimir.com/config/v1/rules/namespace_without_slashes/group_without_slashes?subtype=mimir",
			urlParams:   "?subtype=mimir",
			namedParams: map[string]string{":DatasourceUID": "d164"},
			datasource:  &datasources.DataSource{URL: "http://mimir.com", Type: datasources.DS_PROMETHEUS},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			requestMock := RequestMock{}
			defer requestMock.AssertExpectations(t)

			requestMock.On(
				"withReq",
				mock.Anything,
				mock.Anything,
				mock.AnythingOfType("*url.URL"),
				mock.Anything,
				mock.Anything,
				mock.Anything,
			).Return(response.Empty(200)).Run(func(args mock.Arguments) {
				// Validate that the full url as string is equal to the expected value
				require.Equal(t, tt.expected, args.Get(2).(*url.URL).String())
			})

			// Setup Proxy.
			proxy := &AlertingProxy{DataProxy: &datasourceproxy.DataSourceProxyService{DataSourceCache: fakeCacheService{datasource: tt.datasource}}}
			ruler := &LotexRuler{AlertingProxy: proxy, log: log.NewNopLogger(), requester: &requestMock}

			// Setup request context.
			httpReq, err := http.NewRequest(http.MethodGet, tt.datasource.URL+tt.urlParams, nil)
			require.NoError(t, err)
			ctx := &contextmodel.ReqContext{Context: &web.Context{Req: web.SetURLParams(httpReq, tt.namedParams)}}

			ruler.RouteGetRulegGroupConfig(ctx, tt.namespace, tt.group)
		})
	}
}

type RequestMock struct {
	mock.Mock
}

func (a *RequestMock) withReq(
	ctx *contextmodel.ReqContext,
	method string,
	u *url.URL,
	body io.Reader,
	extractor func(*response.NormalResponse) (any, error),
	headers map[string]string,
) response.Response {
	args := a.Called(ctx, method, u, body, extractor, headers)
	return args.Get(0).(response.Response)
}

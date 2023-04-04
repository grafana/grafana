package api

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
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
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com"}},
			err:             errors.New("unexpected datasource type. expecting loki or prometheus"),
		},
		{
			name:            "with a Loki datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: LokiDatasourceType}},
			expected:        "/api/prom/rules",
		},
		{
			name:            "with a Prometheus datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: PrometheusDatasourceType}},
			expected:        "/rules",
		},
		{
			name:            "with a Prometheus datasource and subtype of Cortex",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			urlParams:       "?subtype=cortex",
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: PrometheusDatasourceType}},
			expected:        "/rules",
		},
		{
			name:            "with a Prometheus datasource and subtype of Mimir",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			urlParams:       "?subtype=mimir",
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: PrometheusDatasourceType}},
			expected:        "/config/v1/rules",
		},
		{
			name:            "with a Prometheus datasource and subtype of Prometheus",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			urlParams:       "?subtype=prometheus",
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: PrometheusDatasourceType}},
			expected:        "/rules",
		},
		{
			name:            "with a Prometheus datasource and no subtype",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://loki.com", Type: PrometheusDatasourceType}},
			expected:        "/rules",
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

func (f fakeCacheService) GetDatasource(_ context.Context, datasourceID int64, _ *user.SignedInUser, _ bool) (*datasources.DataSource, error) {
	if f.err != nil {
		return nil, f.err
	}

	return f.datasource, nil
}

func (f fakeCacheService) GetDatasourceByUID(ctx context.Context, datasourceUID string, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
	if f.err != nil {
		return nil, f.err
	}

	return f.datasource, nil
}

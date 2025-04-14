package api

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
)

func TestLotexProm_GetEndpoints(t *testing.T) {
	tc := []struct {
		name            string
		namedParams     map[string]string
		datasourceCache datasources.CacheService
		expectedRoutes  *promEndpoints
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
			expectedRoutes:  &lokiEndpoints,
			err:             nil,
		},
		{
			name:            "with a Prometheus datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://prom.com", Type: datasources.DS_PROMETHEUS}},
			expectedRoutes:  &prometheusEndpoints,
			err:             nil,
		},
		{
			name:            "with an Amazon Prometheus datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://amp.com", Type: datasources.DS_AMAZON_PROMETHEUS}},
			expectedRoutes:  &prometheusEndpoints,
			err:             nil,
		},
		{
			name:            "with an Azure Prometheus datasource",
			namedParams:     map[string]string{":DatasourceUID": "d164"},
			datasourceCache: fakeCacheService{datasource: &datasources.DataSource{URL: "http://azp.com", Type: datasources.DS_AZURE_PROMETHEUS}},
			expectedRoutes:  &prometheusEndpoints,
			err:             nil,
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			proxy := &AlertingProxy{DataProxy: &datasourceproxy.DataSourceProxyService{DataSourceCache: tt.datasourceCache}}
			prom := &LotexProm{AlertingProxy: proxy, log: log.NewNopLogger()}

			// Setup request context.
			httpReq, err := http.NewRequest(http.MethodGet, "http://grafanacloud.com", nil)
			require.NoError(t, err)
			ctx := &contextmodel.ReqContext{Context: &web.Context{Req: web.SetURLParams(httpReq, tt.namedParams)}}

			endpoints, err := prom.getEndpoints(ctx)

			if tt.err != nil {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedRoutes, endpoints)
			}
		})
	}
}

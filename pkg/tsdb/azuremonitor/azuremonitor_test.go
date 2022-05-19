package azuremonitor

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"

	"github.com/stretchr/testify/require"
)

func TestNewInstanceSettings(t *testing.T) {
	tests := []struct {
		name          string
		settings      backend.DataSourceInstanceSettings
		expectedModel types.DatasourceInfo
		Err           require.ErrorAssertionFunc
	}{
		{
			name: "creates an instance",
			settings: backend.DataSourceInstanceSettings{
				JSONData:                []byte(`{"azureAuthType":"msi"}`),
				DecryptedSecureJSONData: map[string]string{"key": "value"},
				ID:                      40,
			},
			expectedModel: types.DatasourceInfo{
				Cloud:                   azsettings.AzurePublic,
				Credentials:             &azcredentials.AzureManagedIdentityCredentials{},
				Settings:                types.AzureMonitorSettings{},
				Routes:                  routes[azsettings.AzurePublic],
				JSONData:                map[string]interface{}{"azureAuthType": "msi"},
				DatasourceID:            40,
				DecryptedSecureJSONData: map[string]string{"key": "value"},
				Services:                map[string]types.DatasourceService{},
			},
			Err: require.NoError,
		},
	}

	cfg := &setting.Cfg{
		Azure: &azsettings.AzureSettings{
			Cloud: azsettings.AzurePublic,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewInstanceSettings(cfg, &httpclient.Provider{}, map[string]azDatasourceExecutor{})
			instance, err := factory(tt.settings)
			tt.Err(t, err)
			if !cmp.Equal(instance, tt.expectedModel) {
				t.Errorf("Unexpected instance: %v", cmp.Diff(instance, tt.expectedModel))
			}
		})
	}
}

type fakeInstance struct {
	routes   map[string]types.AzRoute
	services map[string]types.DatasourceService
}

func (f *fakeInstance) Get(pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	return types.DatasourceInfo{
		Routes:   f.routes,
		Services: f.services,
	}, nil
}

func (f *fakeInstance) Do(pluginContext backend.PluginContext, fn instancemgmt.InstanceCallbackFunc) error {
	return nil
}

type fakeExecutor struct {
	t           *testing.T
	queryType   string
	expectedURL string
}

func (f *fakeExecutor) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) {
}

func (f *fakeExecutor) ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client,
	url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	if client == nil {
		f.t.Errorf("The HTTP client for %s is missing", f.queryType)
	} else {
		if url != f.expectedURL {
			f.t.Errorf("Unexpected URL %s wanted %s", url, f.expectedURL)
		}
	}
	return &backend.QueryDataResponse{}, nil
}

func Test_newMux(t *testing.T) {
	tests := []struct {
		name        string
		queryType   string
		expectedURL string
		Err         require.ErrorAssertionFunc
	}{
		{
			name:        "creates an Azure Monitor executor",
			queryType:   azureMonitor,
			expectedURL: routes[azureMonitorPublic][azureMonitor].URL,
			Err:         require.NoError,
		},
		{
			name:        "creates an Azure Log Analytics executor",
			queryType:   azureLogAnalytics,
			expectedURL: routes[azureMonitorPublic][azureLogAnalytics].URL,
			Err:         require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				im: &fakeInstance{
					routes: routes[azureMonitorPublic],
					services: map[string]types.DatasourceService{
						tt.queryType: {
							URL:        routes[azureMonitorPublic][tt.queryType].URL,
							HTTPClient: &http.Client{},
						},
					},
				},
				executors: map[string]azDatasourceExecutor{
					tt.queryType: &fakeExecutor{
						t:           t,
						queryType:   tt.queryType,
						expectedURL: tt.expectedURL,
					},
				},
			}
			mux := s.newQueryMux()
			res, err := mux.QueryData(context.Background(), &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{},
				Queries: []backend.DataQuery{
					{QueryType: tt.queryType},
				},
			})
			tt.Err(t, err)
			// Dummy response from the fake implementation
			if res == nil {
				t.Errorf("Expecting a response")
			}
		})
	}
}

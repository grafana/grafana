package azuremonitor

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestNewInstanceSettings(t *testing.T) {
	tests := []struct {
		name          string
		settings      backend.DataSourceInstanceSettings
		expectedModel datasourceInfo
		Err           require.ErrorAssertionFunc
	}{
		{
			name: "creates an instance",
			settings: backend.DataSourceInstanceSettings{
				JSONData:                []byte(`{"cloudName":"azuremonitor"}`),
				DecryptedSecureJSONData: map[string]string{"key": "value"},
				ID:                      40,
			},
			expectedModel: datasourceInfo{
				Settings:                azureMonitorSettings{CloudName: "azuremonitor"},
				Routes:                  routes["azuremonitor"],
				JSONData:                map[string]interface{}{"cloudName": string("azuremonitor")},
				DatasourceID:            40,
				DecryptedSecureJSONData: map[string]string{"key": "value"},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewInstanceSettings()
			instance, err := factory(tt.settings)
			tt.Err(t, err)
			if !cmp.Equal(instance, tt.expectedModel, cmpopts.IgnoreFields(datasourceInfo{}, "Services", "HTTPCliOpts")) {
				t.Errorf("Unexpected instance: %v", cmp.Diff(instance, tt.expectedModel))
			}
		})
	}
}

type fakeInstance struct{}

func (f *fakeInstance) Get(pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	return datasourceInfo{
		Services: map[string]datasourceService{},
		Routes:   routes[azureMonitorPublic],
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

func (f *fakeExecutor) executeTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo datasourceInfo) (*backend.QueryDataResponse, error) {
	if s, ok := dsInfo.Services[f.queryType]; !ok {
		f.t.Errorf("The HTTP client for %s is missing", f.queryType)
	} else {
		if s.URL != f.expectedURL {
			f.t.Errorf("Unexpected URL %s wanted %s", s.URL, f.expectedURL)
		}
	}
	return &backend.QueryDataResponse{}, nil
}

func Test_newExecutor(t *testing.T) {
	cfg := &setting.Cfg{}

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
			mux := newExecutor(&fakeInstance{}, cfg, map[string]azDatasourceExecutor{
				tt.queryType: &fakeExecutor{
					t:           t,
					queryType:   tt.queryType,
					expectedURL: tt.expectedURL,
				},
			})
			res, err := mux.QueryData(context.TODO(), &backend.QueryDataRequest{
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

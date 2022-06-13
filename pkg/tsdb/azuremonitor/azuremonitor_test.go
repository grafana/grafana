package azuremonitor

import (
	"bytes"
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
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

	"github.com/stretchr/testify/assert"
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
	cloud    string
	routes   map[string]types.AzRoute
	services map[string]types.DatasourceService
}

func (f *fakeInstance) Get(pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	return types.DatasourceInfo{
		Cloud:    f.cloud,
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

// RoundTripFunc .
type RoundTripFunc func(req *http.Request) *http.Response

// RoundTrip .
func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

//NewTestClient returns *http.Client with Transport replaced to avoid making real calls
func NewTestClient(fn RoundTripFunc) *http.Client {
	return &http.Client{
		Transport: RoundTripFunc(fn),
	}
}

func TestCheckHealth(t *testing.T) {
	client := NewTestClient(func(req *http.Request) *http.Response {
		if strings.Contains(req.URL.String(), "workspaces") {
			workspaceRes := struct {
				Value []types.LogAnalyticsWorkspaceResponse
			}{
				Value: []types.LogAnalyticsWorkspaceResponse{
					{
						Id:       "abcd-1234",
						Location: "location",
						Name:     "fake-workspace",
						Properties: types.LogAnalyticsWorkspaceProperties{
							CreatedDate: "date",
							CustomerId:  "grafana",
							Features: types.LogAnalyticsWorkspaceFeatures{
								EnableLogAccessUsingOnlyResourcePermissions: false,
								Legacy:        0,
								SearchVersion: 0,
							},
						},
						ProvisioningState:               "provisioned",
						PublicNetworkAccessForIngestion: "enabled",
						PublicNetworkAccessForQuery:     "disabled",
						RetentionInDays:                 365,
					},
				},
			}
			body, err := json.Marshal(workspaceRes)
			if err != nil {
				t.Errorf("Could not marshal workspace response")
			}
			return &http.Response{
				StatusCode: 200,
				Body:       ioutil.NopCloser(bytes.NewBuffer(body)),
				Header:     make(http.Header),
			}
		}
		return &http.Response{
			StatusCode: 200,
			// Send response to be tested
			Body: ioutil.NopCloser(bytes.NewBufferString("OK")),
			// Must be set to non-nil value or it panics
			Header: make(http.Header),
		}
	})
	cloud := "AzureCloud"
	s := &Service{
		im: &fakeInstance{
			cloud:  cloud,
			routes: routes[cloud],
			services: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        routes[cloud]["Azure Monitor"].URL,
					HTTPClient: client,
				},
				azureLogAnalytics: {
					URL:        routes[cloud]["Azure Log Analytics"].URL,
					HTTPClient: client,
				},
				azureResourceGraph: {
					URL:        routes[cloud]["Azure Resource Graph"].URL,
					HTTPClient: client,
				},
			},
		},
	}
	t.Run("Successfully queries all endpoints", func(t *testing.T) {
		res, err := s.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}})

		assert.NoError(t, err)
		assert.Equal(t, &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: "1. Successfully connected to Azure monitor endpoint.\n2. Successfully connected to Azure Log Analytics endpoint.\n3. Successfully connected to Azure Resource Graph endpoint.",
		}, res)
	})
}

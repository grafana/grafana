package azuremonitor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testRoutes = map[string]types.AzRoute{
	azureMonitor: {
		URL:     "https://management.azure.com",
		Scopes:  []string{"https://management.azure.com/.default"},
		Headers: map[string]string{"x-ms-app": "Grafana"},
	},
	azureLogAnalytics: {
		URL:     "https://api.loganalytics.io",
		Scopes:  []string{"https://api.loganalytics.io/.default"},
		Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
	},
	azureResourceGraph: {
		URL:     "https://management.azure.com",
		Scopes:  []string{"https://management.azure.com/.default"},
		Headers: map[string]string{"x-ms-app": "Grafana"},
	},
	azureTraces: {
		URL:     "https://api.loganalytics.io",
		Scopes:  []string{"https://api.loganalytics.io/.default"},
		Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
	},
	traceExemplar: {
		URL:     "https://api.loganalytics.io",
		Scopes:  []string{"https://api.loganalytics.io/.default"},
		Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
	},
	azurePortal: {
		URL: "https://portal.azure.com",
	},
}

func TestNewInstanceSettings(t *testing.T) {
	tests := []struct {
		name          string
		settings      backend.DataSourceInstanceSettings
		expectedModel *types.DatasourceInfo
		Err           require.ErrorAssertionFunc
		setupContext  func(ctx context.Context) context.Context
	}{
		{
			name: "current user authentication disabled by feature toggle",
			settings: backend.DataSourceInstanceSettings{
				JSONData:                []byte(`{"azureAuthType":"currentuser"}`),
				DecryptedSecureJSONData: map[string]string{},
				ID:                      60,
			},
			expectedModel: nil,
			Err: func(t require.TestingT, err error, _ ...interface{}) {
				require.Error(t, err)
				require.Contains(t, err.Error(), "current user authentication is not enabled for azure monitor")
			},
			setupContext: func(ctx context.Context) context.Context {
				featureToggles := backend.NewGrafanaCfg(map[string]string{
					featuretoggles.EnabledFeatures: "", // No enabled features
				})
				return backend.WithGrafanaConfig(ctx, featureToggles)
			},
		},
		{
			name: "creates an instance",
			settings: backend.DataSourceInstanceSettings{
				JSONData:                []byte(`{"azureAuthType":"msi"}`),
				DecryptedSecureJSONData: map[string]string{"key": "value"},
				ID:                      40,
			},
			expectedModel: &types.DatasourceInfo{
				Credentials:             &azcredentials.AzureManagedIdentityCredentials{},
				Settings:                types.AzureMonitorSettings{},
				Routes:                  testRoutes,
				JSONData:                map[string]any{"azureAuthType": "msi"},
				DatasourceID:            40,
				DecryptedSecureJSONData: map[string]string{"key": "value"},
				Services:                map[string]types.DatasourceService{},
			},
			Err: require.NoError,
		},
		{
			name: "creates an instance for customized cloud",
			settings: backend.DataSourceInstanceSettings{
				JSONData:                []byte(`{"cloudName":"customizedazuremonitor","customizedRoutes":{"Route":{"URL":"url"}},"azureAuthType":"clientsecret"}`),
				DecryptedSecureJSONData: map[string]string{"clientSecret": "secret"},
				ID:                      50,
			},
			expectedModel: &types.DatasourceInfo{
				Credentials: &azcredentials.AzureClientSecretCredentials{
					AzureCloud:   "AzureCustomizedCloud",
					ClientSecret: "secret",
				},
				Settings: types.AzureMonitorSettings{},
				Routes: map[string]types.AzRoute{
					"Route": {
						URL: "url",
					},
				},
				JSONData: map[string]any{
					"azureAuthType": "clientsecret",
					"cloudName":     "customizedazuremonitor",
					"customizedRoutes": map[string]any{
						"Route": map[string]any{
							"URL": "url",
						},
					},
				},
				DatasourceID:            50,
				DecryptedSecureJSONData: map[string]string{"clientSecret": "secret"},
				Services:                map[string]types.DatasourceService{},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.setupContext != nil {
				ctx = tt.setupContext(ctx)
			}

			factory := NewInstanceSettings(&httpclient.Provider{}, map[string]azDatasourceExecutor{}, log.DefaultLogger)
			instance, err := factory(ctx, tt.settings)

			tt.Err(t, err)

			if tt.expectedModel == nil {
				require.Nil(t, instance, "Expected instance to be nil")
			} else {
				require.NotNil(t, instance, "Expected instance to be created")
				if !cmp.Equal(instance, *tt.expectedModel) {
					t.Errorf("Unexpected instance: %v", cmp.Diff(instance, *tt.expectedModel))
				}
			}
		})
	}
}

type fakeInstance struct {
	routes   map[string]types.AzRoute
	services map[string]types.DatasourceService
	settings types.AzureMonitorSettings
}

func (f *fakeInstance) Get(_ context.Context, _ backend.PluginContext) (instancemgmt.Instance, error) {
	return types.DatasourceInfo{
		Routes:   f.routes,
		Services: f.services,
		Settings: f.settings,
	}, nil
}

func (f *fakeInstance) Do(_ context.Context, _ backend.PluginContext, _ instancemgmt.InstanceCallbackFunc) error {
	return nil
}

type fakeExecutor struct {
	t           *testing.T
	queryType   string
	expectedURL string
}

func (f *fakeExecutor) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) (http.ResponseWriter, error) {
	return nil, nil
}

func (f *fakeExecutor) ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, fromAlert bool) (*backend.QueryDataResponse, error) {
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
			expectedURL: testRoutes[azureMonitor].URL,
			Err:         require.NoError,
		},
		{
			name:        "creates an Azure Log Analytics executor",
			queryType:   azureLogAnalytics,
			expectedURL: testRoutes[azureLogAnalytics].URL,
			Err:         require.NoError,
		},
		{
			name:        "creates an Azure Traces executor",
			queryType:   azureTraces,
			expectedURL: testRoutes[azureLogAnalytics].URL,
			Err:         require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				im: &fakeInstance{
					routes: testRoutes,
					services: map[string]types.DatasourceService{
						tt.queryType: {
							URL:        testRoutes[tt.queryType].URL,
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
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
						Name: "datasource_name",
						UID:  "datasource_UID",
					},
				},
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

type RoundTripFunc func(req *http.Request) (*http.Response, error)

func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
func NewTestClient(fn RoundTripFunc) *http.Client {
	return &http.Client{
		Transport: fn,
	}
}

func TestCheckHealth(t *testing.T) {
	logAnalyticsResponse := func(empty bool) (*http.Response, error) {
		if !empty {
			body := struct {
				Value []types.LogAnalyticsWorkspaceResponse
			}{Value: []types.LogAnalyticsWorkspaceResponse{{
				Id:       "abcd-1234",
				Location: "location",
				Name:     "test-workspace",
				Properties: types.LogAnalyticsWorkspaceProperties{
					CreatedDate: "",
					CustomerId:  "abcd-1234",
					Features:    types.LogAnalyticsWorkspaceFeatures{},
				},
				ProvisioningState:               "provisioned",
				PublicNetworkAccessForIngestion: "enabled",
				PublicNetworkAccessForQuery:     "disabled",
				RetentionInDays:                 0},
			}}
			bodyMarshal, err := json.Marshal(body)
			if err != nil {
				return nil, err
			}
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBuffer(bodyMarshal)),
				Header:     make(http.Header),
			}, nil
		} else {
			body := struct {
				Value []types.LogAnalyticsWorkspaceResponse
			}{Value: []types.LogAnalyticsWorkspaceResponse{}}
			bodyMarshal, err := json.Marshal(body)
			if err != nil {
				return nil, err
			}
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBuffer(bodyMarshal)),
				Header:     make(http.Header),
			}, nil
		}
	}
	azureMonitorClient := func(logAnalyticsEmpty bool, fail bool) *http.Client {
		return NewTestClient(func(req *http.Request) (*http.Response, error) {
			if strings.Contains(req.URL.String(), "workspaces") {
				return logAnalyticsResponse(logAnalyticsEmpty)
			} else {
				if !fail {
					return &http.Response{
						StatusCode: 200,
						Body:       io.NopCloser(bytes.NewBufferString("{\"value\": [{\"subscriptionId\": \"abcd-1234\"}]}")),
						Header:     make(http.Header),
					}, nil
				} else {
					return &http.Response{
						StatusCode: 404,
						Body:       io.NopCloser(bytes.NewBufferString("not found")),
						Header:     make(http.Header),
					}, nil
				}
			}
		})
	}
	okClient := NewTestClient(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewBufferString("OK")),
			Header:     make(http.Header),
		}, nil
	})
	failClient := func(azureHealthCheckError bool) *http.Client {
		return NewTestClient(func(req *http.Request) (*http.Response, error) {
			if azureHealthCheckError {
				return nil, errors.New("not found")
			}
			return &http.Response{
				StatusCode: 404,
				Body:       io.NopCloser(bytes.NewBufferString("not found")),
				Header:     make(http.Header),
			}, nil
		})
	}

	tests := []struct {
		name           string
		errorExpected  bool
		expectedResult *backend.CheckHealthResult
		customServices map[string]types.DatasourceService
	}{
		{
			name:          "Successfully queries all endpoints",
			errorExpected: false,
			expectedResult: &backend.CheckHealthResult{
				Status:  backend.HealthStatusOk,
				Message: "Successfully connected to all Azure Monitor endpoints.",
			},
			customServices: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        testRoutes["Azure Monitor"].URL,
					HTTPClient: azureMonitorClient(false, false),
				},
				azureLogAnalytics: {
					URL:        testRoutes["Azure Log Analytics"].URL,
					HTTPClient: okClient,
				},
				azureResourceGraph: {
					URL:        testRoutes["Azure Resource Graph"].URL,
					HTTPClient: okClient,
				}},
		},
		{
			name:          "Successfully queries all endpoints except metrics",
			errorExpected: false,
			expectedResult: &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "One or more health checks failed. See details below.",
				JSONDetails: []byte(
					`{"verboseMessage": "1. Error connecting to Azure Monitor endpoint: not found\n2. Successfully connected to Azure Log Analytics endpoint.\n3. Successfully connected to Azure Resource Graph endpoint." }`),
			},
			customServices: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        testRoutes["Azure Monitor"].URL,
					HTTPClient: azureMonitorClient(false, true),
				},
				azureLogAnalytics: {
					URL:        testRoutes["Azure Log Analytics"].URL,
					HTTPClient: okClient,
				},
				azureResourceGraph: {
					URL:        testRoutes["Azure Resource Graph"].URL,
					HTTPClient: okClient,
				}},
		},
		{
			name:          "Successfully queries all endpoints except log analytics",
			errorExpected: false,
			expectedResult: &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "One or more health checks failed. See details below.",
				JSONDetails: []byte(
					`{"verboseMessage": "1. Successfully connected to Azure Monitor endpoint.\n2. Error connecting to Azure Log Analytics endpoint: not found\n3. Successfully connected to Azure Resource Graph endpoint." }`),
			},
			customServices: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        testRoutes["Azure Monitor"].URL,
					HTTPClient: azureMonitorClient(false, false),
				},
				azureLogAnalytics: {
					URL:        testRoutes["Azure Log Analytics"].URL,
					HTTPClient: failClient(false),
				},
				azureResourceGraph: {
					URL:        testRoutes["Azure Resource Graph"].URL,
					HTTPClient: okClient,
				}},
		},
		{
			name:          "Successfully queries all endpoints except resource graph",
			errorExpected: false,
			expectedResult: &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "One or more health checks failed. See details below.",
				JSONDetails: []byte(
					`{"verboseMessage": "1. Successfully connected to Azure Monitor endpoint.\n2. Successfully connected to Azure Log Analytics endpoint.\n3. Error connecting to Azure Resource Graph endpoint: not found" }`),
			},
			customServices: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        testRoutes["Azure Monitor"].URL,
					HTTPClient: azureMonitorClient(false, false),
				},
				azureLogAnalytics: {
					URL:        testRoutes["Azure Log Analytics"].URL,
					HTTPClient: okClient,
				},
				azureResourceGraph: {
					URL:        testRoutes["Azure Resource Graph"].URL,
					HTTPClient: failClient(false),
				}},
		},
		{
			name:          "Successfully returns UNKNOWN status if no log analytics workspace is found",
			errorExpected: false,
			expectedResult: &backend.CheckHealthResult{
				Status:  backend.HealthStatusUnknown,
				Message: "One or more health checks failed. See details below.",
				JSONDetails: []byte(
					`{"verboseMessage": "1. Successfully connected to Azure Monitor endpoint.\n2. No Log Analytics workspaces found.\n3. Successfully connected to Azure Resource Graph endpoint." }`),
			},
			customServices: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        testRoutes["Azure Monitor"].URL,
					HTTPClient: azureMonitorClient(true, false),
				},
				azureLogAnalytics: {
					URL:        testRoutes["Azure Log Analytics"].URL,
					HTTPClient: okClient,
				},
				azureResourceGraph: {
					URL:        testRoutes["Azure Resource Graph"].URL,
					HTTPClient: okClient,
				}},
		},
		{
			name:          "Successfully returns Azure health check errors",
			errorExpected: false,
			expectedResult: &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "One or more health checks failed. See details below.",
				JSONDetails: []byte(
					`{"verboseMessage": "1. Error connecting to Azure Monitor endpoint: health check failed: Get \"https://management.azure.com/subscriptions?api-version=2020-01-01\": not found\n2. Error connecting to Azure Log Analytics endpoint: health check failed: Get \"https://management.azure.com/subscriptions//providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview\": not found\n3. Error connecting to Azure Resource Graph endpoint: health check failed: Post \"https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-06-01-preview\": not found" }`),
			},
			customServices: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        testRoutes["Azure Monitor"].URL,
					HTTPClient: failClient(true),
				},
				azureLogAnalytics: {
					URL:        testRoutes["Azure Log Analytics"].URL,
					HTTPClient: failClient(true),
				},
				azureResourceGraph: {
					URL:        testRoutes["Azure Resource Graph"].URL,
					HTTPClient: failClient(true),
				}},
		},
	}

	instance := &fakeInstance{
		routes:   testRoutes,
		services: map[string]types.DatasourceService{},
		settings: types.AzureMonitorSettings{
			LogAnalyticsDefaultWorkspace: "workspace-id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			instance.services = tt.customServices
			s := &Service{
				im: instance,
			}
			res, err := s.CheckHealth(context.Background(), &backend.CheckHealthRequest{
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
				}})
			if tt.errorExpected {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.expectedResult, res)
		})
	}
}

func Test_QueryData(t *testing.T) {
	tests := []struct {
		name          string
		queryType     string
		expectedURL   string
		Err           require.ErrorAssertionFunc
		ExpectedError error
	}{
		{
			name:          "Azure Monitor query type",
			queryType:     azureMonitor,
			expectedURL:   testRoutes[azureMonitor].URL,
			Err:           require.NoError,
			ExpectedError: nil,
		},
		{
			name:          "Azure Log Analytics query type",
			queryType:     azureLogAnalytics,
			expectedURL:   testRoutes[azureLogAnalytics].URL,
			Err:           require.NoError,
			ExpectedError: nil,
		},
		{
			name:          "Azure Resource Graph query type",
			queryType:     azureResourceGraph,
			expectedURL:   testRoutes[azureResourceGraph].URL,
			Err:           require.NoError,
			ExpectedError: nil,
		},
		{
			name:          "Azure Traces query type",
			queryType:     azureTraces,
			expectedURL:   testRoutes[azureLogAnalytics].URL,
			Err:           require.NoError,
			ExpectedError: nil,
		},
		{
			name:          "traceExemplar query type",
			queryType:     traceExemplar,
			expectedURL:   testRoutes[traceExemplar].URL,
			Err:           require.NoError,
			ExpectedError: nil,
		},
		{
			name:          "Deprecated Application Insights query type",
			queryType:     "Application Insights",
			expectedURL:   "",
			Err:           require.Error,
			ExpectedError: fmt.Errorf("query type: '%s' is no longer supported. Please migrate this query (see https://grafana.com/docs/grafana/v9.0/datasources/azuremonitor/deprecated-application-insights/ for details)", "Application Insights"),
		},
		{
			name:          "Deprecated Insights Analytics query type",
			queryType:     "Insights Analytics",
			expectedURL:   "",
			Err:           require.Error,
			ExpectedError: fmt.Errorf("query type: '%s' is no longer supported. Please migrate this query (see https://grafana.com/docs/grafana/v9.0/datasources/azuremonitor/deprecated-application-insights/ for details)", "Insights Analytics"),
		},
	}

	service := &Service{
		im: &fakeInstance{
			routes: testRoutes,
			services: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        testRoutes[azureMonitor].URL,
					HTTPClient: &http.Client{},
				},
				azureLogAnalytics: {
					URL:        testRoutes[azureLogAnalytics].URL,
					HTTPClient: &http.Client{},
				},
				azureResourceGraph: {
					URL:        testRoutes[azureResourceGraph].URL,
					HTTPClient: &http.Client{},
				},
				azureTraces: {
					URL:        testRoutes[azureTraces].URL,
					HTTPClient: &http.Client{},
				},
				traceExemplar: {
					URL:        testRoutes[traceExemplar].URL,
					HTTPClient: &http.Client{},
				},
			},
		},
		executors: map[string]azDatasourceExecutor{
			azureMonitor: &fakeExecutor{
				t:           t,
				queryType:   azureMonitor,
				expectedURL: testRoutes[azureMonitor].URL,
			},
			azureLogAnalytics: &fakeExecutor{
				t:           t,
				queryType:   azureMonitor,
				expectedURL: testRoutes[azureLogAnalytics].URL,
			},
			azureResourceGraph: &fakeExecutor{
				t:           t,
				queryType:   azureMonitor,
				expectedURL: testRoutes[azureResourceGraph].URL,
			},
			azureTraces: &fakeExecutor{
				t:           t,
				queryType:   azureMonitor,
				expectedURL: testRoutes[azureTraces].URL,
			},
			traceExemplar: &fakeExecutor{
				t:           t,
				queryType:   azureMonitor,
				expectedURL: testRoutes[traceExemplar].URL,
			},
		},
	}
	service.queryMux = service.newQueryMux()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, _ := service.QueryData(context.Background(), &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
						Name: "datasource_name",
						UID:  "datasource_UID",
					},
				},
				Queries: []backend.DataQuery{
					{QueryType: tt.queryType,
						RefID: "test"},
				},
			})

			if res == nil {
				t.Errorf("Expecting a response")
			}

			if res != nil {
				tt.Err(t, res.Responses["test"].Error)
				if tt.ExpectedError != nil {
					assert.EqualError(t, res.Responses["test"].Error, tt.ExpectedError.Error())
				}
			}
		})
	}
}

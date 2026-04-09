package datasource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientrest "k8s.io/client-go/rest"

	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// implements grafanaapiserver.RestConfigProvider
type mockRestConfigProvider struct {
	transport http.RoundTripper
	host      string
}

func (m *mockRestConfigProvider) GetRestConfig(_ context.Context) (*clientrest.Config, error) {
	return &clientrest.Config{
		Host:      m.host,
		Transport: m.transport,
	}, nil
}

type mockRoundTripper struct {
	statusCode   int
	responseBody []byte
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	header := http.Header{}
	header.Set("Content-Type", "application/json")
	return &http.Response{
		StatusCode: m.statusCode,
		Header:     header,
		Body:       io.NopCloser(bytes.NewReader(m.responseBody)),
		Request:    req,
	}, nil
}

func TestGetConnectionByUID(t *testing.T) {
	tests := []struct {
		name          string
		uid           string
		statusCode    int
		responseBody  []byte
		expectedError string
		expectedItems []dsV0.DataSourceConnection
	}{
		{
			name:          "connection not found returns error",
			uid:           "non-existent-uid",
			statusCode:    http.StatusNotFound,
			responseBody:  mustMarshal(t, metav1.Status{Reason: metav1.StatusReasonNotFound, Code: http.StatusNotFound}),
			expectedError: "datasource connection not found: non-existent-uid",
		},
		{
			name:          "forbidden access returns error",
			uid:           "test-uid",
			statusCode:    http.StatusForbidden,
			responseBody:  mustMarshal(t, metav1.Status{Reason: metav1.StatusReasonForbidden, Code: http.StatusForbidden}),
			expectedError: "failed to get connection",
		},
		{
			name:       "multiple connections returned",
			uid:        "test-uid",
			statusCode: http.StatusOK,
			responseBody: mustMarshal(t, dsV0.DataSourceConnectionList{
				Items: []dsV0.DataSourceConnection{{Name: "conn1"}, {Name: "conn2"}},
			}),
			expectedItems: []dsV0.DataSourceConnection{{Name: "conn1"}, {Name: "conn2"}},
		},
		{
			name:       "single connection returned",
			uid:        "test-uid",
			statusCode: http.StatusOK,
			responseBody: mustMarshal(t, dsV0.DataSourceConnectionList{
				Items: []dsV0.DataSourceConnection{{Name: "test-uid"}},
			}),
			expectedItems: []dsV0.DataSourceConnection{{Name: "test-uid"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &connectionClientImpl{
				clientConfigProvider: &mockRestConfigProvider{
					transport: &mockRoundTripper{
						statusCode:   tt.statusCode,
						responseBody: tt.responseBody,
					},
					host: "http://localhost:3000",
				},
				namespaceMapper: func(orgID int64) string { return "default" },
			}

			result, err := client.GetConnectionByUID(context.Background(), 1, tt.uid)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				assert.Equal(t, tt.expectedItems, result.Items)
			}
		})
	}
}

func mustMarshal(t *testing.T, v any) []byte {
	t.Helper()
	data, err := json.Marshal(v)
	require.NoError(t, err)
	return data
}

func TestGetConnectionByUIDLegacy(t *testing.T) {
	tests := []struct {
		name           string
		dsResponse     *datasources.DataSource
		dsError        error
		expectedResult *dsV0.DataSourceConnectionList
		expectedError  error
	}{
		{
			name:          "service error returns error",
			dsResponse:    nil,
			dsError:       errors.New("some error"),
			expectedError: errors.New("some error"),
		},
		{
			name:       "datasource not found returns empty list",
			dsResponse: nil,
			expectedResult: &dsV0.DataSourceConnectionList{
				Items: []dsV0.DataSourceConnection{},
			},
		},
		{
			name: "datasource found returns connection",
			dsResponse: &datasources.DataSource{
				UID:  "uid",
				Type: "type",
			},
			expectedResult: &dsV0.DataSourceConnectionList{
				Items: []dsV0.DataSourceConnection{
					{
						Name:       "uid",
						APIGroup:   "type.datasource.grafana.app",
						APIVersion: "v0alpha1",
						Plugin:     "type",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &legacyConnectionClientImpl{
				datasourceService: &mockDataSourceService{
					response: tt.dsResponse,
					error:    tt.dsError,
				},
			}

			conn, err := client.GetConnectionByUID(context.Background(), 1, "uid")

			if tt.expectedError != nil {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError.Error())
				assert.Nil(t, conn)
			} else {
				require.NoError(t, err)
				require.NotNil(t, conn)
				assert.Equal(t, tt.expectedResult, conn)
			}
		})
	}
}

// mock the datasource service
type mockDataSourceService struct {
	datasources.DataSourceService
	response *datasources.DataSource
	error    error
}

func (m *mockDataSourceService) GetDataSource(_ context.Context, _ *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	return m.response, m.error
}

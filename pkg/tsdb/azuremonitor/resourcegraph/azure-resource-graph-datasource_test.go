package resourcegraph

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

var logger = log.New("test")

func TestBuildingAzureResourceGraphQueries(t *testing.T) {
	datasource := &AzureResourceGraphDatasource{}
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

	tests := []struct {
		name                      string
		queryModel                []backend.DataQuery
		timeRange                 backend.TimeRange
		azureResourceGraphQueries []*AzureResourceGraphQuery
		Err                       require.ErrorAssertionFunc
	}{
		{
			name: "Query with macros should be interpolated",
			timeRange: backend.TimeRange{
				From: fromStart,
				To:   fromStart.Add(34 * time.Minute),
			},
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(`{
						"queryType": "Azure Resource Graph",
						"azureResourceGraph": {
							"query":        "resources | where $__contains(name,'res1','res2')",
							"resultFormat": "table"
						}
					}`),
					RefID: "A",
				},
			},
			azureResourceGraphQueries: []*AzureResourceGraphQuery{
				{
					RefID:        "A",
					ResultFormat: "table",
					URL:          "",
					JSON: []byte(`{
						"queryType": "Azure Resource Graph",
						"azureResourceGraph": {
							"query":        "resources | where $__contains(name,'res1','res2')",
							"resultFormat": "table"
						}
					}`),
					InterpolatedQuery: "resources | where ['name'] in ('res1','res2')",
				},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			queries, err := datasource.buildQueries(logger, tt.queryModel, types.DatasourceInfo{})
			tt.Err(t, err)
			if diff := cmp.Diff(tt.azureResourceGraphQueries, queries, cmpopts.IgnoreUnexported(simplejson.Json{})); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAzureResourceGraphCreateRequest(t *testing.T) {
	ctx := context.Background()
	url := "http://ds"

	tests := []struct {
		name            string
		expectedURL     string
		expectedHeaders http.Header
		Err             require.ErrorAssertionFunc
	}{
		{
			name:        "creates a request",
			expectedURL: "http://ds/",
			expectedHeaders: http.Header{
				"Content-Type": []string{"application/json"},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := AzureResourceGraphDatasource{}
			req, err := ds.createRequest(ctx, logger, []byte{}, url)
			tt.Err(t, err)
			if req.URL.String() != tt.expectedURL {
				t.Errorf("Expecting %s, got %s", tt.expectedURL, req.URL.String())
			}
			if !cmp.Equal(req.Header, tt.expectedHeaders) {
				t.Errorf("Unexpected HTTP headers: %v", cmp.Diff(req.Header, tt.expectedHeaders))
			}
		})
	}
}

func TestAddConfigData(t *testing.T) {
	field := data.Field{}
	dataLink := data.DataLink{Title: "View in Azure Portal", TargetBlank: true, URL: "http://ds"}
	frame := data.Frame{
		Fields: []*data.Field{&field},
	}
	frameWithLink := AddConfigLinks(frame, "http://ds")
	expectedFrameWithLink := data.Frame{
		Fields: []*data.Field{
			{
				Config: &data.FieldConfig{
					Links: []data.DataLink{dataLink},
				},
			},
		},
	}
	if !cmp.Equal(frameWithLink, expectedFrameWithLink, data.FrameTestCompareOptions()...) {
		t.Errorf("unexpepcted frame: %v", cmp.Diff(frameWithLink, expectedFrameWithLink, data.FrameTestCompareOptions()...))
	}
}

func TestGetAzurePortalUrl(t *testing.T) {
	clouds := []string{azsettings.AzurePublic, azsettings.AzureChina, azsettings.AzureUSGovernment}
	expectedAzurePortalUrl := map[string]interface{}{
		azsettings.AzurePublic:       "https://portal.azure.com",
		azsettings.AzureChina:        "https://portal.azure.cn",
		azsettings.AzureUSGovernment: "https://portal.azure.us",
	}

	for _, cloud := range clouds {
		azurePortalUrl, err := GetAzurePortalUrl(cloud)
		if err != nil {
			t.Errorf("The cloud not supported")
		}
		assert.Equal(t, expectedAzurePortalUrl[cloud], azurePortalUrl)
	}
}

func TestUnmarshalResponse400(t *testing.T) {
	datasource := &AzureResourceGraphDatasource{}
	res, err := datasource.unmarshalResponse(logger, &http.Response{
		StatusCode: 400,
		Status:     "400 Bad Request",
		Body:       io.NopCloser(strings.NewReader(("Azure Error Message"))),
	})

	expectedErrMsg := "400 Bad Request. Azure Resource Graph error: Azure Error Message"

	assert.Equal(t, expectedErrMsg, err.Error())
	assert.Empty(t, res)
}

func TestUnmarshalResponse200Invalid(t *testing.T) {
	datasource := &AzureResourceGraphDatasource{}
	res, err := datasource.unmarshalResponse(logger, &http.Response{
		StatusCode: 200,
		Status:     "OK",
		Body:       io.NopCloser(strings.NewReader(("Azure Data"))),
	})

	expectedRes := AzureResourceGraphResponse{}
	expectedErr := "invalid character 'A' looking for beginning of value"

	assert.Equal(t, expectedErr, err.Error())
	assert.Equal(t, expectedRes, res)
}

func TestUnmarshalResponse200(t *testing.T) {
	datasource := &AzureResourceGraphDatasource{}
	res, err2 := datasource.unmarshalResponse(logger, &http.Response{
		StatusCode: 200,
		Status:     "OK",
		Body:       io.NopCloser(strings.NewReader("{}")),
	})

	expectedRes := AzureResourceGraphResponse{}

	assert.NoError(t, err2)
	assert.Equal(t, expectedRes, res)
}

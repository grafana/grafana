package azuremonitor

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildingAzureResourceGraphQueries(t *testing.T) {
	datasource := &AzureResourceGraphDatasource{}
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

	tests := []struct {
		name                      string
		queryModel                []backend.DataQuery
		timeRange                 plugins.DataTimeRange
		azureResourceGraphQueries []*AzureResourceGraphQuery
		Err                       require.ErrorAssertionFunc
	}{
		{
			name: "Query with macros should be interpolated",
			timeRange: plugins.DataTimeRange{
				From: fmt.Sprintf("%v", fromStart.Unix()*1000),
				To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
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
			queries, err := datasource.buildQueries(tt.queryModel, datasourceInfo{})
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
	dsInfo := datasourceInfo{}

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
				"User-Agent":   []string{"Grafana/"},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := AzureResourceGraphDatasource{}
			req, err := ds.createRequest(ctx, dsInfo, []byte{}, url)
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
	frameWithLink := addConfigData(frame, "http://ds")
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
	clouds := []string{setting.AzurePublic, setting.AzureChina, setting.AzureUSGovernment, setting.AzureGermany}
	expectedAzurePortalUrl := map[string]interface{}{
		setting.AzurePublic:       "https://portal.azure.com",
		setting.AzureChina:        "https://portal.azure.cn",
		setting.AzureUSGovernment: "https://portal.azure.us",
		setting.AzureGermany:      "https://portal.microsoftazure.de",
	}

	for _, cloud := range clouds {
		azurePortalUrl, err := getAzurePortalUrl(cloud)
		if err != nil {
			t.Errorf("The cloud not supported")
		}
		assert.Equal(t, expectedAzurePortalUrl[cloud], azurePortalUrl)
	}
}

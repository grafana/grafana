package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/testdata"
	azTime "github.com/grafana/grafana/pkg/tsdb/azuremonitor/time"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func Pointer[T any](v T) *T { return &v }

func TestAzureMonitorBuildQueries(t *testing.T) {
	datasource := &AzureMonitorDatasource{}
	dsInfo := types.DatasourceInfo{
		Settings: types.AzureMonitorSettings{
			SubscriptionId: "default-subscription",
		},
	}

	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
	duration, _ := time.ParseDuration("400s")
	wildcardFilter := "*"
	testFilter := "test"
	tests := []struct {
		name                         string
		azureMonitorVariedProperties map[string]any
		azureMonitorQueryTarget      string
		expectedInterval             string
		queryInterval                time.Duration
		expectedURL                  string
		expectedBodyFilter           string
		expectedParamFilter          string
		expectedPortalURL            *string
		resources                    map[string]dataquery.AzureMonitorResource
	}{
		{
			name: "Parse queries from frontend and build AzureMonitor API queries",
			azureMonitorVariedProperties: map[string]any{
				"resourceURI": "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana",
				"timeGrain":   "PT1M",
				"top":         "10",
			},
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=10",
		},
		{
			name: "legacy query without resourceURI and time grain set to auto",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain": "auto",
				"top":       "10",
			},
			queryInterval:           duration,
			expectedInterval:        "PT15M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT15M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=10",
		},
		{
			name: "legacy query without resourceURI and time grain set to auto",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":           "auto",
				"allowedTimeGrainsMs": []int64{60000, 300000},
				"top":                 "10",
			},
			queryInterval:           duration,
			expectedInterval:        "PT5M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT5M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=10",
		},
		{
			name: "legacy query without resourceURI and has a dimension filter",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":       "PT1M",
				"dimension":       "blob",
				"dimensionFilter": "*",
				"top":             "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq '*'",
		},
		{
			name: "legacy query without resourceURI and has a dimension filter and none Dimension",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":       "PT1M",
				"dimension":       "None",
				"dimensionFilter": "*",
				"top":             "10",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=10",
		},
		{
			name: "legacy query without resourceURI and has dimensionFilter*s* property with one dimension",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":        "PT1M",
				"dimensionFilters": []dataquery.AzureMetricDimension{{Dimension: strPtr("blob"), Operator: strPtr("eq"), Filter: &wildcardFilter}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq '*'",
			expectedPortalURL:       Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "legacy query without resourceURI and has dimensionFilter*s* property with two dimensions",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":        "PT1M",
				"dimensionFilters": []dataquery.AzureMetricDimension{{Dimension: strPtr("blob"), Operator: strPtr("eq"), Filter: &wildcardFilter}, {Dimension: strPtr("tier"), Operator: strPtr("eq"), Filter: &wildcardFilter}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq '*' and tier eq '*'",
			expectedPortalURL:       Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "legacy query without resourceURI and has a dimension filter without specifying a top",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":       "PT1M",
				"dimension":       "blob",
				"dimensionFilter": "*",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
			expectedParamFilter:     "blob eq '*'",
		},
		{
			name: "has dimensionFilter*s* property with not equals operator",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":        "PT1M",
				"dimensionFilters": []dataquery.AzureMetricDimension{{Dimension: strPtr("blob"), Operator: strPtr("ne"), Filter: &wildcardFilter, Filters: []string{"test"}}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob ne 'test'",
			expectedPortalURL:       Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A1%2C%22values%22%3A%5B%22test%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "has dimensionFilter*s* property with startsWith operator",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":        "PT1M",
				"dimensionFilters": []dataquery.AzureMetricDimension{{Dimension: strPtr("blob"), Operator: strPtr("sw"), Filter: &testFilter}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob sw 'test'",
			expectedPortalURL:       Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A3%2C%22values%22%3A%5B%22test%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "correctly sets dimension operator to eq (irrespective of operator) when filter value is '*'",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":        "PT1M",
				"dimensionFilters": []dataquery.AzureMetricDimension{{Dimension: strPtr("blob"), Operator: strPtr("sw"), Filter: &wildcardFilter}, {Dimension: strPtr("tier"), Operator: strPtr("ne"), Filter: &wildcardFilter}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq '*' and tier eq '*'",
			expectedPortalURL:       Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "correctly constructs target when multiple filter values are provided for the 'eq' operator",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":        "PT1M",
				"dimensionFilters": []dataquery.AzureMetricDimension{{Dimension: strPtr("blob"), Operator: strPtr("eq"), Filter: &wildcardFilter, Filters: []string{"test", "test2"}}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq 'test' or blob eq 'test2'",
			expectedPortalURL:       Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A0%2C%22values%22%3A%5B%22test%22%2C%22test2%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "correctly constructs target when multiple filter values are provided for ne 'eq' operator",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":        "PT1M",
				"dimensionFilters": []dataquery.AzureMetricDimension{{Dimension: strPtr("blob"), Operator: strPtr("ne"), Filter: &wildcardFilter, Filters: []string{"test", "test2"}}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob ne 'test' and blob ne 'test2'",
			expectedPortalURL:       Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A1%2C%22values%22%3A%5B%22test%22%2C%22test2%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "Includes a region",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain": "PT1M",
				"top":       "10",
				"region":    "westus",
			},
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&region=westus&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=10",
			expectedURL:             "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
		},
		{
			name: "Includes a region and a filter in the body with multiple resources",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain": "PT1M",
				"top":       "10",
				"region":    "westus",
				"resources": []dataquery.AzureMonitorResource{{ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm")}, {ResourceGroup: strPtr("rg2"), ResourceName: strPtr("vm2")}},
			},
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&region=westus&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=10",
			expectedURL:             "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/providers/microsoft.insights/metrics",
			expectedBodyFilter:      "Microsoft.ResourceId eq '/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm' or Microsoft.ResourceId eq '/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg2/providers/Microsoft.Compute/virtualMachines/vm2'",
		},
		{
			name: "includes a single resource as a parameter filter",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain": "PT1M",
				"resources": []dataquery.AzureMonitorResource{{ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm")}},
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
			expectedURL:             "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm/providers/microsoft.insights/metrics",
		},
		{
			name: "includes a resource and a dimesion as filters",
			azureMonitorVariedProperties: map[string]any{
				"timeGrain":        "PT1M",
				"resources":        []dataquery.AzureMonitorResource{{ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm")}, {ResourceGroup: strPtr("rg2"), ResourceName: strPtr("vm2")}},
				"dimensionFilters": []dataquery.AzureMetricDimension{{Dimension: strPtr("blob"), Operator: strPtr("ne"), Filter: &wildcardFilter, Filters: []string{"test", "test2"}}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			expectedURL:             "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/providers/microsoft.insights/metrics",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedBodyFilter:      "(Microsoft.ResourceId eq '/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm' or Microsoft.ResourceId eq '/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg2/providers/Microsoft.Compute/virtualMachines/vm2') and (blob ne 'test' and blob ne 'test2')",
			expectedPortalURL:       Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A1%2C%22values%22%3A%5B%22test%22%2C%22test2%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
	}

	commonAzureModelProps := map[string]any{
		"aggregation":     "Average",
		"resourceGroup":   "grafanastaging",
		"resourceName":    "grafana",
		"metricNamespace": "Microsoft.Compute/virtualMachines",
		"metricName":      "Percentage CPU",

		"alias":     "testalias",
		"queryType": "Azure Monitor",
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for k, v := range commonAzureModelProps {
				tt.azureMonitorVariedProperties[k] = v
			}
			azureMonitorJSON, _ := json.Marshal(tt.azureMonitorVariedProperties)
			tsdbQuery := []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
							"subscription": "12345678-aaaa-bbbb-cccc-123456789abc",
							"azureMonitor": %s
						}`, string(azureMonitorJSON))),
					RefID:    "A",
					Interval: tt.queryInterval,
					TimeRange: backend.TimeRange{
						From: fromStart,
						To:   fromStart.Add(34 * time.Minute),
					},
				},
			}

			query, err := datasource.buildQuery(tsdbQuery[0], dsInfo)
			require.NoError(t, err)

			resources := map[string]dataquery.AzureMonitorResource{}
			if tt.azureMonitorVariedProperties["resources"] != nil {
				resourceSlice := tt.azureMonitorVariedProperties["resources"].([]dataquery.AzureMonitorResource)
				for _, resource := range resourceSlice {
					resources[strings.ToLower(fmt.Sprintf("/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/%s/providers/Microsoft.Compute/virtualMachines/%s", *resource.ResourceGroup, *resource.ResourceName))] = resource
				}
			} else {
				resources[strings.ToLower("/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana")] = dataquery.AzureMonitorResource{ResourceGroup: strPtr("grafanastaging"), ResourceName: strPtr("grafana")}
			}

			azureMonitorQuery := &types.AzureMonitorQuery{
				URL:    tt.expectedURL,
				Target: tt.azureMonitorQueryTarget,
				RefID:  "A",
				Alias:  "testalias",
				TimeRange: backend.TimeRange{
					From: fromStart,
					To:   fromStart.Add(34 * time.Minute),
				},
				BodyFilter:   tt.expectedBodyFilter,
				Subscription: "12345678-aaaa-bbbb-cccc-123456789abc",
				Resources:    resources,
			}

			assert.Equal(t, tt.expectedParamFilter, query.Params.Get("$filter"))
			if azureMonitorQuery.URL == "" {
				azureMonitorQuery.URL = "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics"
			}

			if diff := cmp.Diff(azureMonitorQuery, query, cmpopts.IgnoreUnexported(struct{}{}), cmpopts.IgnoreFields(types.AzureMonitorQuery{}, "Params", "Dimensions")); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			expectedPortalURL := `http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/` +
				`TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/` +
				`ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C` +
				`%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D`
			if tt.expectedPortalURL != nil {
				expectedPortalURL = *tt.expectedPortalURL
			}

			actual, err := getQueryUrl(query, "http://ds", "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana", "grafana")
			require.NoError(t, err)
			require.Equal(t, expectedPortalURL, actual)
		})
	}
}

func TestCustomNamespace(t *testing.T) {
	datasource := &AzureMonitorDatasource{}

	t.Run("it should set the metricNamespace to a customNamespace value if customNamespace is present as a parameter", func(t *testing.T) {
		q := []backend.DataQuery{
			{
				JSON: []byte(`{
							"azureMonitor": {
								"customNamespace": "custom/namespace"
							}
						}`),
			},
		}

		result, err := datasource.buildQuery(q[0], types.DatasourceInfo{})
		require.NoError(t, err)
		expected := "custom/namespace"
		require.Equal(t, expected, result.Params.Get("metricnamespace"))
	})
}

func TestAzureMonitorParseResponse(t *testing.T) {
	resources := map[string]dataquery.AzureMonitorResource{}
	resources[strings.ToLower("/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana")] =
		dataquery.AzureMonitorResource{ResourceGroup: strPtr("grafanastaging"), ResourceName: strPtr("grafana")}
	subscription := "12345678-aaaa-bbbb-cccc-123456789abc"

	tests := []struct {
		name            string
		responseFile    string
		mockQuery       *types.AzureMonitorQuery
		expectedFrames  data.Frames
		queryIntervalMS int64
	}{
		{
			name:         "average aggregate time series response",
			responseFile: "azuremonitor/1-azure-monitor-response-avg.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Average"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "total aggregate time series response",
			responseFile: "azuremonitor/2-azure-monitor-response-total.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Total"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "maximum aggregate time series response",
			responseFile: "azuremonitor/3-azure-monitor-response-maximum.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Maximum"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "minimum aggregate time series response",
			responseFile: "azuremonitor/4-azure-monitor-response-minimum.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Minimum"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "count aggregate time series response",
			responseFile: "azuremonitor/5-azure-monitor-response-count.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Count"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "single dimension time series response",
			responseFile: "azuremonitor/6-azure-monitor-response-single-dimension.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Average"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "with alias patterns in the query",
			responseFile: "azuremonitor/2-azure-monitor-response-total.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}}",
				Params: url.Values{
					"aggregation": {"Total"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "single dimension with alias",
			responseFile: "azuremonitor/6-azure-monitor-response-single-dimension.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "{{dimensionname}}={{DimensionValue}}",
				Params: url.Values{
					"aggregation": {"Average"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "multiple dimension time series response with label alias",
			responseFile: "azuremonitor/7-azure-monitor-response-multi-dimension.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanatest/providers/Microsoft.Storage/storageAccounts/testblobaccount/blobServices/default/providers/Microsoft.Insights/metrics",
				Alias: "{{resourcegroup}} {Blob Type={{blobtype}}, Tier={{Tier}}}",
				Params: url.Values{
					"aggregation": {"Average"},
				},
				Resources:    map[string]dataquery.AzureMonitorResource{strings.ToLower("/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanatest/providers/Microsoft.Storage/storageAccounts/testblobaccount/blobServices/default/providers/Microsoft.Insights/metrics"): {ResourceGroup: strPtr("grafanatest"), ResourceName: strPtr("testblobaccount")}},
				Subscription: subscription,
			},
		},
		{
			name:         "unspecified unit with alias should not panic",
			responseFile: "azuremonitor/8-azure-monitor-response-unspecified-unit.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "custom",
				Params: url.Values{
					"aggregation": {"Average"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "with legacy azure monitor query properties and without a resource uri",
			responseFile: "azuremonitor/2-azure-monitor-response-total.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}}",
				Params: url.Values{
					"aggregation": {"Total"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "with legacy azure monitor query properties and with a resource uri it should use the resource uri",
			responseFile: "azuremonitor/2-azure-monitor-response-total.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}}",
				Params: url.Values{
					"aggregation": {"Total"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "multiple time series response",
			responseFile: "azuremonitor/9-azure-monitor-response-multi.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Average"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
		{
			name:         "multiple time series response with multiple dimensions",
			responseFile: "azuremonitor/10-azure-monitor-response-multi-with-dimensions.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Average"},
				},
				Resources:    resources,
				Subscription: subscription,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			azData := loadTestFile(t, tt.responseFile)
			datasource := &AzureMonitorDatasource{}
			dframes, err := datasource.parseResponse(azData, tt.mockQuery, "http://ds", "")
			require.NoError(t, err)
			require.NotNil(t, dframes)

			testdata.CheckGoldenFrames(t, "../testdata", fmt.Sprintf("%s.%s", tt.responseFile, strings.ReplaceAll(tt.name, " ", "-")), dframes)
		})
	}
}

func TestFindClosestAllowIntervalMS(t *testing.T) {
	humanIntervalToMS := map[string]int64{
		"3m":  180000,
		"5m":  300000,
		"10m": 600000,
		"15m": 900000,
		"1d":  86400000,
		"2d":  172800000,
	}
	tests := []struct {
		name              string
		allowedTimeGrains []int64 // Note: Uses defaults when empty list
		inputInterval     int64
		expectedInterval  int64
	}{
		{
			name:              "closest to 3m is 5m",
			allowedTimeGrains: []int64{},
			inputInterval:     humanIntervalToMS["3m"],
			expectedInterval:  humanIntervalToMS["5m"],
		},
		{
			name:              "closest to 10m is 15m",
			allowedTimeGrains: []int64{},
			inputInterval:     humanIntervalToMS["10m"],
			expectedInterval:  humanIntervalToMS["15m"],
		},
		{
			name:              "closest to 2d is 1d",
			allowedTimeGrains: []int64{},
			inputInterval:     humanIntervalToMS["2d"],
			expectedInterval:  humanIntervalToMS["1d"],
		},
		{
			name:              "closest to 3m is 1d when 1d is only allowed interval",
			allowedTimeGrains: []int64{humanIntervalToMS["1d"]},
			inputInterval:     humanIntervalToMS["2d"],
			expectedInterval:  humanIntervalToMS["1d"],
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interval := azTime.FindClosestAllowedIntervalMS(tt.inputInterval, tt.allowedTimeGrains)
			require.Equal(t, tt.expectedInterval, interval)
		})
	}
}

func loadTestFile(t *testing.T, name string) types.AzureMonitorResponse {
	t.Helper()

	path := filepath.Join("../testdata", name)
	// Ignore gosec warning G304 since it's a test
	// nolint:gosec
	jsonBody, err := os.ReadFile(path)
	require.NoError(t, err)

	var azData types.AzureMonitorResponse
	err = json.Unmarshal(jsonBody, &azData)
	require.NoError(t, err)
	return azData
}

func TestAzureMonitorCreateRequest(t *testing.T) {
	ctx := context.Background()
	url := "http://ds/"

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
			ds := AzureMonitorDatasource{}
			req, err := ds.createRequest(ctx, url)
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

func TestExtractResourceNameFromMetricsURL(t *testing.T) {
	t.Run("it should extract the resourceName from a well-formed Metrics URL", func(t *testing.T) {
		url := "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/Grafana-Test.VM/providers/microsoft.insights/metrics"
		expected := "Grafana-Test.VM"
		require.Equal(t, expected, extractResourceNameFromMetricsURL((url)))
	})
	t.Run("it should extract the resourceName from a well-formed Metrics URL in a case insensitive manner", func(t *testing.T) {
		url := "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/Grafana-Test.VM/pRoViDeRs/MiCrOsOfT.iNsIgHtS/mEtRiCs"
		expected := "Grafana-Test.VM"
		require.Equal(t, expected, extractResourceNameFromMetricsURL((url)))
	})
	t.Run("it should return an empty string if no match is found", func(t *testing.T) {
		url := "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/Grafana-Test.VM/providers/microsoft.insights/nope-this-part-does-not-match"
		expected := ""
		require.Equal(t, expected, extractResourceNameFromMetricsURL((url)))
	})
}

func strPtr(s string) *string {
	return &s
}

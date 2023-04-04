package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	azTime "github.com/grafana/grafana/pkg/tsdb/azuremonitor/time"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/util"
)

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
		azureMonitorVariedProperties map[string]interface{}
		azureMonitorQueryTarget      string
		expectedInterval             string
		queryInterval                time.Duration
		expectedURL                  string
		expectedBodyFilter           string
		expectedParamFilter          string
		expectedPortalURL            *string
	}{
		{
			name: "Parse queries from frontend and build AzureMonitor API queries",
			azureMonitorVariedProperties: map[string]interface{}{
				"resourceURI": "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana",
				"timeGrain":   "PT1M",
				"top":         "10",
			},
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
		},
		{
			name: "legacy query without resourceURI and time grain set to auto",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain": "auto",
				"top":       "10",
			},
			queryInterval:           duration,
			expectedInterval:        "PT15M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT15M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
		},
		{
			name: "legacy query without resourceURI and time grain set to auto",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":           "auto",
				"allowedTimeGrainsMs": []int64{60000, 300000},
				"top":                 "10",
			},
			queryInterval:           duration,
			expectedInterval:        "PT5M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT5M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
		},
		{
			name: "legacy query without resourceURI and has a dimension filter",
			azureMonitorVariedProperties: map[string]interface{}{
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
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":       "PT1M",
				"dimension":       "None",
				"dimensionFilter": "*",
				"top":             "10",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
		},
		{
			name: "legacy query without resourceURI and has dimensionFilter*s* property with one dimension",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":        "PT1M",
				"dimensionFilters": []types.AzureMonitorDimensionFilter{{Dimension: "blob", Operator: "eq", Filter: &wildcardFilter}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq '*'",
			expectedPortalURL:       util.Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "legacy query without resourceURI and has dimensionFilter*s* property with two dimensions",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":        "PT1M",
				"dimensionFilters": []types.AzureMonitorDimensionFilter{{Dimension: "blob", Operator: "eq", Filter: &wildcardFilter}, {Dimension: "tier", Operator: "eq", Filter: &wildcardFilter}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq '*' and tier eq '*'",
			expectedPortalURL:       util.Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "legacy query without resourceURI and has a dimension filter without specifying a top",
			azureMonitorVariedProperties: map[string]interface{}{
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
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":        "PT1M",
				"dimensionFilters": []types.AzureMonitorDimensionFilter{{Dimension: "blob", Operator: "ne", Filter: &wildcardFilter, Filters: []string{"test"}}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob ne 'test'",
			expectedPortalURL:       util.Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A1%2C%22values%22%3A%5B%22test%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "has dimensionFilter*s* property with startsWith operator",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":        "PT1M",
				"dimensionFilters": []types.AzureMonitorDimensionFilter{{Dimension: "blob", Operator: "sw", Filter: &testFilter}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob sw 'test'",
			expectedPortalURL:       util.Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A3%2C%22values%22%3A%5B%22test%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "correctly sets dimension operator to eq (irrespective of operator) when filter value is '*'",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":        "PT1M",
				"dimensionFilters": []types.AzureMonitorDimensionFilter{{Dimension: "blob", Operator: "sw", Filter: &wildcardFilter}, {Dimension: "tier", Operator: "ne", Filter: &wildcardFilter}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq '*' and tier eq '*'",
			expectedPortalURL:       util.Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "correctly constructs target when multiple filter values are provided for the 'eq' operator",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":        "PT1M",
				"dimensionFilters": []types.AzureMonitorDimensionFilter{{Dimension: "blob", Operator: "eq", Filter: &wildcardFilter, Filters: []string{"test", "test2"}}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob eq 'test' or blob eq 'test2'",
			expectedPortalURL:       util.Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A0%2C%22values%22%3A%5B%22test%22%2C%22test2%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "correctly constructs target when multiple filter values are provided for ne 'eq' operator",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":        "PT1M",
				"dimensionFilters": []types.AzureMonitorDimensionFilter{{Dimension: "blob", Operator: "ne", Filter: &wildcardFilter, Filters: []string{"test", "test2"}}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedParamFilter:     "blob ne 'test' and blob ne 'test2'",
			expectedPortalURL:       util.Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A1%2C%22values%22%3A%5B%22test%22%2C%22test2%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
		{
			name: "Includes a region",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain": "PT1M",
				"top":       "10",
				"region":    "westus",
			},
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&region=westus&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
			expectedURL:             "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
		},
		{
			name: "Includes a region and a filter in the body with multiple resources",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain": "PT1M",
				"top":       "10",
				"region":    "westus",
				"resources": []types.AzureMonitorResource{{ResourceGroup: "rg", ResourceName: "vm"}, {ResourceGroup: "rg2", ResourceName: "vm2"}},
			},
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&region=westus&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
			expectedURL:             "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/providers/microsoft.insights/metrics",
			expectedBodyFilter:      "Microsoft.ResourceId eq '/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm' or Microsoft.ResourceId eq '/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg2/providers/Microsoft.Compute/virtualMachines/vm2'",
		},
		{
			name: "includes a single resource as a parameter filter",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain": "PT1M",
				"resources": []types.AzureMonitorResource{{ResourceGroup: "rg", ResourceName: "vm"}},
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
			expectedURL:             "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm/providers/microsoft.insights/metrics",
		},
		{
			name: "includes a resource and a dimesion as filters",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":        "PT1M",
				"resources":        []types.AzureMonitorResource{{ResourceGroup: "rg", ResourceName: "vm"}, {ResourceGroup: "rg2", ResourceName: "vm2"}},
				"dimensionFilters": []types.AzureMonitorDimensionFilter{{Dimension: "blob", Operator: "ne", Filter: &wildcardFilter, Filters: []string{"test", "test2"}}},
				"top":              "30",
			},
			queryInterval:           duration,
			expectedInterval:        "PT1M",
			expectedURL:             "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/providers/microsoft.insights/metrics",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute%2FvirtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
			expectedBodyFilter:      "(Microsoft.ResourceId eq '/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm' or Microsoft.ResourceId eq '/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/rg2/providers/Microsoft.Compute/virtualMachines/vm2') and (blob ne 'test' and blob ne 'test2')",
			expectedPortalURL:       util.Pointer("http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22filterCollection%22%3A%7B%22filters%22%3A%5B%7B%22key%22%3A%22blob%22%2C%22operator%22%3A1%2C%22values%22%3A%5B%22test%22%2C%22test2%22%5D%7D%5D%7D%2C%22grouping%22%3A%7B%22dimension%22%3A%22blob%22%2C%22sort%22%3A2%2C%22top%22%3A10%7D%2C%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D"),
		},
	}

	commonAzureModelProps := map[string]interface{}{
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

			queries, err := datasource.buildQueries(log.New("test"), tsdbQuery, dsInfo)
			require.NoError(t, err)

			azureMonitorQuery := &types.AzureMonitorQuery{
				URL:    tt.expectedURL,
				Target: tt.azureMonitorQueryTarget,
				RefID:  "A",
				Alias:  "testalias",
				TimeRange: backend.TimeRange{
					From: fromStart,
					To:   fromStart.Add(34 * time.Minute),
				},
				BodyFilter: tt.expectedBodyFilter,
			}

			assert.Equal(t, tt.expectedParamFilter, queries[0].Params.Get("$filter"))
			if azureMonitorQuery.URL == "" {
				azureMonitorQuery.URL = "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics"
			}

			if diff := cmp.Diff(azureMonitorQuery, queries[0], cmpopts.IgnoreUnexported(simplejson.Json{}), cmpopts.IgnoreFields(types.AzureMonitorQuery{}, "Params", "Dimensions")); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			expectedPortalURL := `http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/` +
				`TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%222018-03-15T13%3A00%3A00Z%22%2C%22endTime%22%3A%222018-03-15T13%3A34%3A00Z%22%7D%7D/` +
				`ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C` +
				`%22name%22%3A%22Percentage%20CPU%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22Microsoft.Compute%2FvirtualMachines%22%2C%22metricVisualization%22%3A%7B%22displayName%22%3A%22Percentage%20CPU%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D`
			if tt.expectedPortalURL != nil {
				expectedPortalURL = *tt.expectedPortalURL
			}

			actual, err := getQueryUrl(queries[0], "http://ds", "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana", "grafana")
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

		result, err := datasource.buildQueries(log.New("test"), q, types.DatasourceInfo{})
		require.NoError(t, err)
		expected := "custom/namespace"
		require.Equal(t, expected, result[0].Params.Get("metricnamespace"))
	})
}

func makeDates(startDate time.Time, count int, interval time.Duration) (times []time.Time) {
	for i := 0; i < count; i++ {
		times = append(times, startDate.Add(interval*time.Duration(i)))
	}
	return
}

func makeTestDataLink(url string) data.DataLink {
	return data.DataLink{
		Title:       "View in Azure Portal",
		TargetBlank: true,
		URL:         url,
	}
}

func TestAzureMonitorParseResponse(t *testing.T) {
	// datalinks for the test frames
	averageLink := makeTestDataLink(`http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%220001-01-01T00%3A00%3A00Z%22%2C%22endTime%22%3A%220001-01-01T00%3A00%3A00Z%22%7D%7D/` +
		`ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22%22%2C%22aggregationType%22%3A4%2C%22namespace%22%3A%22%22%2C` +
		`%22metricVisualization%22%3A%7B%22displayName%22%3A%22%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D`)
	totalLink := makeTestDataLink(`http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%220001-01-01T00%3A00%3A00Z%22%2C%22endTime%22%3A%220001-01-01T00%3A00%3A00Z%22%7D%7D/` +
		`ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22%22%2C%22aggregationType%22%3A1%2C%22namespace%22%3A%22%22%2C` +
		`%22metricVisualization%22%3A%7B%22displayName%22%3A%22%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D`)
	maxLink := makeTestDataLink(`http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%220001-01-01T00%3A00%3A00Z%22%2C%22endTime%22%3A%220001-01-01T00%3A00%3A00Z%22%7D%7D/` +
		`ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22%22%2C%22aggregationType%22%3A3%2C%22namespace%22%3A%22%22%2C` +
		`%22metricVisualization%22%3A%7B%22displayName%22%3A%22%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D`)
	minLink := makeTestDataLink(`http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%220001-01-01T00%3A00%3A00Z%22%2C%22endTime%22%3A%220001-01-01T00%3A00%3A00Z%22%7D%7D/` +
		`ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22%22%2C%22aggregationType%22%3A2%2C%22namespace%22%3A%22%22%2C` +
		`%22metricVisualization%22%3A%7B%22displayName%22%3A%22%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D`)
	countLink := makeTestDataLink(`http://ds/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%7B%22absolute%22%3A%7B%22startTime%22%3A%220001-01-01T00%3A00%3A00Z%22%2C%22endTime%22%3A%220001-01-01T00%3A00%3A00Z%22%7D%7D/` +
		`ChartDefinition/%7B%22v2charts%22%3A%5B%7B%22metrics%22%3A%5B%7B%22resourceMetadata%22%3A%7B%22id%22%3A%22%2Fsubscriptions%2F12345678-aaaa-bbbb-cccc-123456789abc%2FresourceGroups%2Fgrafanastaging%2Fproviders%2FMicrosoft.Compute%2FvirtualMachines%2Fgrafana%22%7D%2C%22name%22%3A%22%22%2C%22aggregationType%22%3A7%2C%22namespace%22%3A%22%22%2C` +
		`%22metricVisualization%22%3A%7B%22displayName%22%3A%22%22%2C%22resourceDisplayName%22%3A%22grafana%22%7D%7D%5D%7D%5D%7D`)

	tests := []struct {
		name            string
		responseFile    string
		mockQuery       *types.AzureMonitorQuery
		expectedFrames  data.Frames
		queryIntervalMS int64
	}{
		{
			name:         "average aggregate time series response",
			responseFile: "1-azure-monitor-response-avg.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 8, 10, 13, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(2.0875), util.Pointer(2.1525), util.Pointer(2.155), util.Pointer(3.6925), util.Pointer(2.44),
					}).SetConfig(&data.FieldConfig{Unit: "percent", Links: []data.DataLink{averageLink}})),
			},
		},
		{
			name:         "total aggregate time series response",
			responseFile: "2-azure-monitor-response-total.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Total"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 13, 29, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{totalLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(8.26), util.Pointer(8.7), util.Pointer(14.82), util.Pointer(10.07), util.Pointer(8.52),
					}).SetConfig(&data.FieldConfig{Unit: "percent", Links: []data.DataLink{totalLink}})),
			},
		},
		{
			name:         "maximum aggregate time series response",
			responseFile: "3-azure-monitor-response-maximum.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Maximum"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 14, 26, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{maxLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(3.07), util.Pointer(2.92), util.Pointer(2.87), util.Pointer(2.27), util.Pointer(2.52),
					}).SetConfig(&data.FieldConfig{Unit: "percent", Links: []data.DataLink{maxLink}})),
			},
		},
		{
			name:         "minimum aggregate time series response",
			responseFile: "4-azure-monitor-response-minimum.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Minimum"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 14, 43, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{minLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(1.51), util.Pointer(2.38), util.Pointer(1.69), util.Pointer(2.27), util.Pointer(1.96),
					}).SetConfig(&data.FieldConfig{Unit: "percent", Links: []data.DataLink{minLink}})),
			},
		},
		{
			name:         "count aggregate time series response",
			responseFile: "5-azure-monitor-response-count.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Count"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 14, 44, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{countLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(4.0), util.Pointer(4.0), util.Pointer(4.0), util.Pointer(4.0), util.Pointer(4.0),
					}).SetConfig(&data.FieldConfig{Unit: "percent", Links: []data.DataLink{countLink}})),
			},
		},
		{
			name:         "single dimension time series response",
			responseFile: "6-azure-monitor-response-single-dimension.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Count", data.Labels{"blobtype": "PageBlob"},
						[]*float64{util.Pointer(3.0), util.Pointer(3.0), util.Pointer(3.0), util.Pointer(3.0), util.Pointer(3.0), nil}).
						SetConfig(&data.FieldConfig{Unit: "short", Links: []data.DataLink{averageLink}, DisplayName: "Blob Count grafana"})),

				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Count", data.Labels{"blobtype": "BlockBlob"},
						[]*float64{util.Pointer(1.0), util.Pointer(1.0), util.Pointer(1.0), util.Pointer(1.0), util.Pointer(1.0), nil}).
						SetConfig(&data.FieldConfig{Unit: "short", Links: []data.DataLink{averageLink}, DisplayName: "Blob Count grafana"})),

				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Count", data.Labels{"blobtype": "Azure Data Lake Storage"},
						[]*float64{util.Pointer(0.0), util.Pointer(0.0), util.Pointer(0.0), util.Pointer(0.0), util.Pointer(0.0), nil}).
						SetConfig(&data.FieldConfig{Unit: "short", Links: []data.DataLink{averageLink}, DisplayName: "Blob Count grafana"})),
			},
		},
		{
			name:         "with alias patterns in the query",
			responseFile: "2-azure-monitor-response-total.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}}",
				Params: url.Values{
					"aggregation": {"Total"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 13, 29, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{totalLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(8.26), util.Pointer(8.7), util.Pointer(14.82), util.Pointer(10.07), util.Pointer(8.52),
					}).SetConfig(&data.FieldConfig{Unit: "percent", DisplayName: "custom grafanastaging Microsoft.Compute/virtualMachines grafana Percentage CPU", Links: []data.DataLink{totalLink}})),
			},
		},
		{
			name:         "single dimension with alias",
			responseFile: "6-azure-monitor-response-single-dimension.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "{{dimensionname}}={{DimensionValue}}",
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Count", data.Labels{"blobtype": "PageBlob"},
						[]*float64{util.Pointer(3.0), util.Pointer(3.0), util.Pointer(3.0), util.Pointer(3.0), util.Pointer(3.0), nil}).SetConfig(&data.FieldConfig{Unit: "short", DisplayName: "blobtype=PageBlob", Links: []data.DataLink{averageLink}})),

				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Count", data.Labels{"blobtype": "BlockBlob"}, []*float64{
						util.Pointer(1.0), util.Pointer(1.0), util.Pointer(1.0), util.Pointer(1.0), util.Pointer(1.0), nil,
					}).SetConfig(&data.FieldConfig{Unit: "short", DisplayName: "blobtype=BlockBlob", Links: []data.DataLink{averageLink}})),

				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Count", data.Labels{"blobtype": "Azure Data Lake Storage"}, []*float64{
						util.Pointer(0.0), util.Pointer(0.0), util.Pointer(0.0), util.Pointer(0.0), util.Pointer(0.0), nil,
					}).SetConfig(&data.FieldConfig{Unit: "short", DisplayName: "blobtype=Azure Data Lake Storage", Links: []data.DataLink{averageLink}})),
			},
		},
		{
			name:         "multiple dimension time series response with label alias",
			responseFile: "7-azure-monitor-response-multi-dimension.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "{{resourcegroup}} {Blob Type={{blobtype}}, Tier={{Tier}}}",
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2020, 06, 30, 9, 58, 0, 0, time.UTC), 3, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Capacity", data.Labels{"blobtype": "PageBlob", "tier": "Standard"},
						[]*float64{util.Pointer(675530.0), util.Pointer(675530.0), util.Pointer(675530.0)}).SetConfig(
						&data.FieldConfig{Unit: "decbytes", DisplayName: "danieltest {Blob Type=PageBlob, Tier=Standard}", Links: []data.DataLink{averageLink}})),

				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2020, 06, 30, 9, 58, 0, 0, time.UTC), 3, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Capacity", data.Labels{"blobtype": "BlockBlob", "tier": "Hot"},
						[]*float64{util.Pointer(0.0), util.Pointer(0.0), util.Pointer(0.0)}).SetConfig(
						&data.FieldConfig{Unit: "decbytes", DisplayName: "danieltest {Blob Type=BlockBlob, Tier=Hot}", Links: []data.DataLink{averageLink}})),

				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2020, 06, 30, 9, 58, 0, 0, time.UTC), 3, time.Hour),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Blob Capacity", data.Labels{"blobtype": "Azure Data Lake Storage", "tier": "Cool"},
						[]*float64{util.Pointer(0.0), util.Pointer(0.0), util.Pointer(0.0)}).SetConfig(
						&data.FieldConfig{Unit: "decbytes", DisplayName: "danieltest {Blob Type=Azure Data Lake Storage, Tier=Cool}", Links: []data.DataLink{averageLink}})),
			},
		},
		{
			name:         "unspecified unit with alias should not panic",
			responseFile: "8-azure-monitor-response-unspecified-unit.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "custom",
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						[]time.Time{time.Date(2019, 2, 8, 10, 13, 0, 0, time.UTC)},
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(2.0875),
					}).SetConfig(&data.FieldConfig{DisplayName: "custom", Links: []data.DataLink{averageLink}})),
			},
		},
		{
			name:         "with legacy azure monitor query properties and without a resource uri",
			responseFile: "2-azure-monitor-response-total.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}}",
				Params: url.Values{
					"aggregation": {"Total"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 13, 29, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{totalLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(8.26), util.Pointer(8.7), util.Pointer(14.82), util.Pointer(10.07), util.Pointer(8.52),
					}).SetConfig(&data.FieldConfig{Unit: "percent", DisplayName: "custom grafanastaging Microsoft.Compute/virtualMachines grafana Percentage CPU", Links: []data.DataLink{totalLink}})),
			},
		},
		{
			name:         "with legacy azure monitor query properties and with a resource uri it should use the resource uri",
			responseFile: "2-azure-monitor-response-total.json",
			mockQuery: &types.AzureMonitorQuery{
				URL:   "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}}",
				Params: url.Values{
					"aggregation": {"Total"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 9, 13, 29, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{totalLink}}),
					data.NewField("Percentage CPU", nil, []*float64{
						util.Pointer(8.26), util.Pointer(8.7), util.Pointer(14.82), util.Pointer(10.07), util.Pointer(8.52),
					}).SetConfig(&data.FieldConfig{Unit: "percent", DisplayName: "custom grafanastaging Microsoft.Compute/virtualMachines grafana Percentage CPU", Links: []data.DataLink{totalLink}})),
			},
		},
		{
			name:         "multiple time series response",
			responseFile: "9-azure-monitor-response-multi.json",
			mockQuery: &types.AzureMonitorQuery{
				URL: "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/providers/microsoft.insights/metrics",
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("Time", nil,
						makeDates(time.Date(2019, 2, 8, 10, 13, 0, 0, time.UTC), 5, time.Minute),
					).SetConfig(&data.FieldConfig{Links: []data.DataLink{averageLink}}),
					data.NewField("Percentage CPU", data.Labels{"microsoft.resourceid": "/subscriptions/12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana"}, []*float64{
						util.Pointer(2.0875), util.Pointer(2.1525), util.Pointer(2.155), util.Pointer(3.6925), util.Pointer(2.44),
					}).SetConfig(&data.FieldConfig{Unit: "percent", Links: []data.DataLink{averageLink}, DisplayName: "Percentage CPU grafana"}),
				),
			},
		},
	}

	datasource := &AzureMonitorDatasource{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			azData := loadTestFile(t, "azuremonitor/"+tt.responseFile)
			dframes, err := datasource.parseResponse(azData, tt.mockQuery, "http://ds")
			require.NoError(t, err)
			require.NotNil(t, dframes)

			if diff := cmp.Diff(tt.expectedFrames, dframes, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
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
			req, err := ds.createRequest(ctx, log.New("test"), url)
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

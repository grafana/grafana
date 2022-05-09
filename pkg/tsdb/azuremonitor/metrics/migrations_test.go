package metrics

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func TestDimensionFiltersMigration(t *testing.T) {
	wildcard := "*"
	testFilter := "testFilter"
	additionalTestFilter := "testFilter2"
	tests := []struct {
		name                     string
		dimensionFilters         []types.AzureMonitorDimensionFilter
		expectedDimensionFilters []types.AzureMonitorDimensionFilter
	}{
		{
			name:                     "will return new format unchanged",
			dimensionFilters:         []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filters: []string{"testFilter"}}},
			expectedDimensionFilters: []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filters: []string{"testFilter"}}},
		},
		{
			name:                     "correctly updates old format with wildcard",
			dimensionFilters:         []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filter: &wildcard}},
			expectedDimensionFilters: []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq"}},
		},
		{
			name:                     "correctly updates old format with a value",
			dimensionFilters:         []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filter: &testFilter}},
			expectedDimensionFilters: []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filters: []string{testFilter}}},
		},
		{
			name:                     "correctly ignores wildcard if filters has a value",
			dimensionFilters:         []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filter: &wildcard, Filters: []string{testFilter}}},
			expectedDimensionFilters: []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filters: []string{testFilter}}},
		},
		{
			name:                     "correctly merges values if filters has a value (ignores duplicates)",
			dimensionFilters:         []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filter: &testFilter, Filters: []string{testFilter}}},
			expectedDimensionFilters: []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filters: []string{testFilter}}},
		},
		{
			name:                     "correctly merges values if filters has a value",
			dimensionFilters:         []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filter: &additionalTestFilter, Filters: []string{testFilter}}},
			expectedDimensionFilters: []types.AzureMonitorDimensionFilter{{Dimension: "testDimension", Operator: "eq", Filters: []string{testFilter, additionalTestFilter}}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filters := MigrateDimensionFilters(tt.dimensionFilters)

			if diff := cmp.Diff(tt.expectedDimensionFilters, filters, cmpopts.IgnoreUnexported(simplejson.Json{})); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

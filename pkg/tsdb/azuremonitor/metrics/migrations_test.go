package metrics

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
)

func TestDimensionFiltersMigration(t *testing.T) {
	wildcard := "*"
	testFilter := "testFilter"
	additionalTestFilter := "testFilter2"
	tests := []struct {
		name                     string
		dimensionFilters         []dataquery.AzureMetricDimension
		expectedDimensionFilters []dataquery.AzureMetricDimension
	}{
		{
			name:                     "will return new format unchanged",
			dimensionFilters:         []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filters: []string{"testFilter"}}},
			expectedDimensionFilters: []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filters: []string{"testFilter"}}},
		},
		{
			name:                     "correctly updates old format with wildcard",
			dimensionFilters:         []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filter: &wildcard}},
			expectedDimensionFilters: []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq")}},
		},
		{
			name:                     "correctly updates old format with a value",
			dimensionFilters:         []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filter: &testFilter}},
			expectedDimensionFilters: []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filters: []string{testFilter}}},
		},
		{
			name:                     "correctly ignores wildcard if filters has a value",
			dimensionFilters:         []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filter: &wildcard, Filters: []string{testFilter}}},
			expectedDimensionFilters: []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filters: []string{testFilter}}},
		},
		{
			name:                     "correctly merges values if filters has a value (ignores duplicates)",
			dimensionFilters:         []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filter: &testFilter, Filters: []string{testFilter}}},
			expectedDimensionFilters: []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filters: []string{testFilter}}},
		},
		{
			name:                     "correctly merges values if filters has a value",
			dimensionFilters:         []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filter: &additionalTestFilter, Filters: []string{testFilter}}},
			expectedDimensionFilters: []dataquery.AzureMetricDimension{{Dimension: strPtr("testDimension"), Operator: strPtr("eq"), Filters: []string{testFilter, additionalTestFilter}}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filters := MigrateDimensionFilters(tt.dimensionFilters)

			if diff := cmp.Diff(tt.expectedDimensionFilters, filters, cmpopts.IgnoreUnexported(struct{}{})); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

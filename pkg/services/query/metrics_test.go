package query

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetDatasourceType(t *testing.T) {
	type test struct {
		name        string
		datasources []string
		result      string
	}

	tests := []test{
		{
			name:        "returns None when no datasources",
			datasources: []string{},
			result:      None,
		},
		{
			name:        "returns Mixed when more than one datasource",
			datasources: []string{"ds1", "ds2"},
			result:      Mixed,
		},
		{
			name:        "returns ds name when only one datasource",
			datasources: []string{"ds1"},
			result:      "ds1",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(t, testCase.result, getDatasourceType(testCase.datasources))
		})
	}
}

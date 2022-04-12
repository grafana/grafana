package ualert

import (
	"testing"

	"github.com/grafana/grafana/pkg/util"

	"github.com/stretchr/testify/require"
)

func TestMigrateAlertRuleQueries(t *testing.T) {
	tc := []struct {
		name     string
		input    alertQuery
		expected string
		error    bool
	}{
		{
			name:     "should override 'target' when when 'targetFull' exists",
			input:    alertQuery{Model: []byte(`{"targetFull": "thisisafullquery", "target": "ahalfquery"}`)},
			expected: `{"target":"thisisafullquery"}`,
		},
		{
			name:     "should do nothing when no targetFull",
			input:    alertQuery{Model: []byte(`{"target": "ahalfquery"}`)},
			expected: `{"target":"ahalfquery"}`,
		},
		{
			name:  "should fail if 'target' contains nested references and datasource is Graphite",
			input: alertQuery{Model: []byte(`"target": "timeShift(#B, '7d')"`), datasourceType: "graphite"},
			error: true,
		},
		{
			name:  "should fail if targetFull contains nested references",
			input: alertQuery{Model: []byte(`{"targetFull": "timeShift(#B, '7d')", "target": "timeShift(#B, '7d')"}`), datasourceType: "graphite"},
			error: true,
		},
		{
			name:     "should not fail if 'target' contains nested references and datasource is not Graphite",
			input:    alertQuery{Model: []byte(`{"targetFull": "timeShift(#C, '7d')", "target": "timeShift(#B, '7d')"}`), datasourceType: util.GenerateShortUID()},
			expected: `{"target": "timeShift(#C, '7d')"}`,
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			queries, err := migrateAlertRuleQueries([]alertQuery{tt.input})
			if tt.error {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			r, err := queries[0].Model.MarshalJSON()
			require.NoError(t, err)
			require.JSONEq(t, tt.expected, string(r))
		})
	}
}

package usagestats

import (
	"io/ioutil"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

func TestParsingAlertRuleSettings(t *testing.T) {
	tcs := []struct {
		name      string
		file      string
		expected  []int64
		shouldErr require.ErrorAssertionFunc
	}{
		{
			name:      "can parse valid test datasource alert",
			file:      "testdata/one_condition.json",
			expected:  []int64{3},
			shouldErr: require.NoError,
		},
		{
			name:      "can parse valid test datasource alert",
			file:      "testdata/two_conditions.json",
			expected:  []int64{3, 2},
			shouldErr: require.NoError,
		},
		{
			name:      "can parse valid test datasource alert",
			file:      "testdata/empty.json",
			expected:  []int64{},
			shouldErr: require.NoError,
		},
		{
			name:      "can parse valid test datasource alert",
			file:      "testdata/invalid_format.json",
			expected:  []int64{},
			shouldErr: require.Error,
		},
	}

	uss := &UsageStatsService{}
	err := uss.Init()
	require.NoError(t, err, "Init should not return an error")

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			content, err := ioutil.ReadFile(tc.file)
			require.NoError(t, err, "expected to be able to read file")

			result, err := uss.parseAlertRuleModel(content)
			tc.shouldErr(t, err)
			diff := cmp.Diff(tc.expected, result)
			if diff != "" {
				t.Errorf("result missmatch (-want +got) %s\n", diff)
			}
		})
	}
}

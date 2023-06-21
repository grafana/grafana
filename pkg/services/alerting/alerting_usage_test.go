package alerting

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	fd "github.com/grafana/grafana/pkg/services/datasources/fakes"
)

func TestAlertingUsageStats(t *testing.T) {
	store := &AlertStoreMock{}
	dsMock := &fd.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{ID: 1, Type: datasources.DS_INFLUXDB},
			{ID: 2, Type: datasources.DS_GRAPHITE},
			{ID: 3, Type: datasources.DS_PROMETHEUS},
			{ID: 4, Type: datasources.DS_PROMETHEUS},
		},
	}
	ae := &AlertEngine{
		AlertStore:        store,
		datasourceService: dsMock,
	}

	store.getAllAlerts = func(ctx context.Context, query *models.GetAllAlertsQuery) (res []*models.Alert, err error) {
		var createFake = func(file string) *simplejson.Json {
			// Ignore gosec warning G304 since it's a test
			// nolint:gosec
			content, err := os.ReadFile(file)
			require.NoError(t, err, "expected to be able to read file")

			j, err := simplejson.NewJson(content)
			require.NoError(t, err)
			return j
		}

		return []*models.Alert{
			{ID: 1, Settings: createFake("testdata/settings/one_condition.json")},
			{ID: 2, Settings: createFake("testdata/settings/two_conditions.json")},
			{ID: 2, Settings: createFake("testdata/settings/three_conditions.json")},
			{ID: 3, Settings: createFake("testdata/settings/empty.json")},
		}, nil
	}

	result, err := ae.QueryUsageStats(context.Background())
	require.NoError(t, err, "getAlertingUsage should not return error")

	expected := map[string]int{
		"prometheus": 4,
		"graphite":   2,
	}

	for k := range expected {
		if expected[k] != result.DatasourceUsage[k] {
			t.Errorf("result mismatch for %s. got %v expected %v", k, result.DatasourceUsage[k], expected[k])
		}
	}
}

func TestParsingAlertRuleSettings(t *testing.T) {
	tcs := []struct {
		name      string
		file      string
		expected  []int64
		shouldErr require.ErrorAssertionFunc
	}{
		{
			name:      "can parse single condition",
			file:      "testdata/settings/one_condition.json",
			expected:  []int64{3},
			shouldErr: require.NoError,
		},
		{
			name:      "can parse multiple conditions",
			file:      "testdata/settings/two_conditions.json",
			expected:  []int64{3, 2},
			shouldErr: require.NoError,
		},
		{
			name:      "can parse empty json",
			file:      "testdata/settings/empty.json",
			expected:  []int64{},
			shouldErr: require.NoError,
		},
		{
			name:      "can handle nil content",
			expected:  []int64{},
			shouldErr: require.NoError,
		},
	}

	ae := &AlertEngine{}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			var settings json.Marshaler
			if tc.file != "" {
				content, err := os.ReadFile(tc.file)
				require.NoError(t, err, "expected to be able to read file")

				settings, err = simplejson.NewJson(content)
				require.NoError(t, err)
			}

			result, err := ae.parseAlertRuleModel(settings)

			tc.shouldErr(t, err)
			diff := cmp.Diff(tc.expected, result)
			if diff != "" {
				t.Errorf("result mismatch (-want +got) %s\n", diff)
			}
		})
	}
}

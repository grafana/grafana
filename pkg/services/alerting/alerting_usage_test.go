package alerting

import (
	"io/ioutil"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestAlertingUsageStats(t *testing.T) {
	ae := &AlertEngine{
		Bus: bus.New(),
	}

	ae.Bus.AddHandler(func(query *models.GetAllAlertsQuery) error {
		var createFake = func(file string) *simplejson.Json {
			content, err := ioutil.ReadFile(file)
			require.NoError(t, err, "expected to be able to read file")

			j, _ := simplejson.NewJson(content)
			return j
		}

		query.Result = []*models.Alert{
			{Id: 1, Settings: createFake("testdata/settings/one_condition.json")},
			{Id: 2, Settings: createFake("testdata/settings/two_conditions.json")},
			{Id: 2, Settings: createFake("testdata/settings/three_conditions.json")},
			{Id: 3, Settings: createFake("testdata/settings/empty.json")},
		}
		return nil
	})

	ae.Bus.AddHandler(func(query *models.GetDataSourceByIdQuery) error {
		ds := map[int64]*models.DataSource{
			1: {Type: "influxdb"},
			2: {Type: "graphite"},
			3: {Type: "prometheus"},
			4: {Type: "prometheus"},
		}

		r, exist := ds[query.Id]
		if !exist {
			return models.ErrDataSourceNotFound
		}

		query.Result = r
		return nil
	})

	err := ae.Init()
	require.NoError(t, err, "Init should not return error")

	result, err := ae.QueryUsageStats()
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
			name:      "can parse blank content",
			file:      "testdata/settings/invalid_format.json",
			expected:  []int64{},
			shouldErr: require.NoError,
		},
	}

	ae := &AlertEngine{}
	err := ae.Init()
	require.NoError(t, err, "Init should not return an error")

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			content, err := ioutil.ReadFile(tc.file)
			require.NoError(t, err, "expected to be able to read file")

			j, _ := simplejson.NewJson(content)

			result, err := ae.parseAlertRuleModel(j)

			tc.shouldErr(t, err)
			diff := cmp.Diff(tc.expected, result)
			if diff != "" {
				t.Errorf("result mismatch (-want +got) %s\n", diff)
			}
		})
	}
}

package migration

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestMigrateAlertRuleGraphiteQueries(t *testing.T) {
	tc := []struct {
		name      string
		input     *simplejson.Json
		dashboard *dashboards.Dashboard
		panelID   int64
		expected  string
	}{
		{
			name: "when a query has a sub query - it is not unwrapped if unavailable through dasboards",
			input: simplejson.NewFromAny(map[string]any{
				"refId":  "C",
				"target": "scale(asPercent(diffSeries(#B, #A), #B), 100)",
				"datasource": map[string]any{
					"type": "graphite",
				},
			}),
			expected: `{"datasource":{"type": "graphite"}, "refId":"C", "target":"scale(asPercent(diffSeries(second.query.count, first.query.count), second.query.count), 100)"}`,
			panelID:  123,
			dashboard: &dashboards.Dashboard{
				Data: simplejson.NewFromAny(map[string]any{
					"panels": []map[string]any{
						{
							"id": 123,
							"targets": []target{
								{
									RefID:  "A",
									Target: "first.query.count",
								},
								{
									RefID:  "B",
									Target: "second.query.count",
								},
								{
									RefID:  "C",
									Target: "scale(asPercent(diffSeries(#B, #A), #B), 100)",
								},
							},
						},
					},
				}),
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			model, err := tt.input.Encode()
			require.NoError(t, err)
			queries, err := migrateAlertRuleQueries(&logtest.Fake{}, []models.AlertQuery{{Model: model}}, tt.panelID, tt.dashboard)
			require.NoError(t, err)

			r, err := queries[0].Model.MarshalJSON()
			require.NoError(t, err)
			require.JSONEq(t, tt.expected, string(r))
		})
	}
}

func TestUnwrapTarget(t *testing.T) {
	targets := []target{
		{
			RefID:  "A",
			Target: "first.query.count",
		},
		{
			RefID:  "B",
			Target: "second.query.count",
		},
		{
			RefID:  "C",
			Target: "scale(asPercent(diffSeries(#B, #A), #B), 100)",
		},
	}
	expected := "scale(asPercent(diffSeries(second.query.count, first.query.count), second.query.count), 100)"
	result := unwrapTarget("C", targets)
	require.Equal(t, expected, result)
}

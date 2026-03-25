package state

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func makeThresholdModel(t *testing.T, evalType string, params []float64) json.RawMessage {
	t.Helper()
	m := map[string]any{
		"type":       "threshold",
		"expression": "A",
		"conditions": []map[string]any{
			{
				"evaluator": map[string]any{
					"type":   evalType,
					"params": params,
				},
			},
		},
	}
	b, err := json.Marshal(m)
	require.NoError(t, err)
	return b
}

func TestExtractConfiguredThreshold(t *testing.T) {
	tests := []struct {
		name string
		rule *ngmodels.AlertRule
		want *float64
	}{
		{
			name: "gt threshold",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: makeThresholdModel(t, "gt", []float64{90})},
				},
			},
			want: util.Pointer[float64](90),
		},
		{
			name: "lt threshold",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: makeThresholdModel(t, "lt", []float64{50})},
				},
			},
			want: util.Pointer[float64](50),
		},
		{
			name: "within_range uses first param",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: makeThresholdModel(t, "within_range", []float64{10, 100})},
				},
			},
			want: util.Pointer[float64](10),
		},
		{
			name: "outside_range uses first param",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: makeThresholdModel(t, "outside_range", []float64{10, 100})},
				},
			},
			want: util.Pointer[float64](10),
		},
		{
			name: "old datasource UID",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.OldDatasourceUID, Model: makeThresholdModel(t, "gt", []float64{42})},
				},
			},
			want: util.Pointer[float64](42),
		},
		{
			name: "condition RefID not found",
			rule: &ngmodels.AlertRule{
				Condition: "C",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: makeThresholdModel(t, "gt", []float64{90})},
				},
			},
			want: nil,
		},
		{
			name: "condition is not expression datasource",
			rule: &ngmodels.AlertRule{
				Condition: "A",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus", Model: makeThresholdModel(t, "gt", []float64{90})},
				},
			},
			want: nil,
		},
		{
			name: "condition is math type not threshold",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: func() json.RawMessage {
						m := map[string]any{
							"type":       "math",
							"expression": "$A > 90",
						}
						b, _ := json.Marshal(m)
						return b
					}()},
				},
			},
			want: nil,
		},
		{
			name: "empty conditions array",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: func() json.RawMessage {
						m := map[string]any{
							"type":       "threshold",
							"expression": "A",
							"conditions": []map[string]any{},
						}
						b, _ := json.Marshal(m)
						return b
					}()},
				},
			},
			want: nil,
		},
		{
			name: "empty params",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "A", DatasourceUID: "prometheus"},
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: makeThresholdModel(t, "gt", []float64{})},
				},
			},
			want: nil,
		},
		{
			name: "malformed model JSON",
			rule: &ngmodels.AlertRule{
				Condition: "B",
				Data: []ngmodels.AlertQuery{
					{RefID: "B", DatasourceUID: expr.DatasourceUID, Model: json.RawMessage(`{invalid json}`)},
				},
			},
			want: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractConfiguredThreshold(tt.rule)
			assert.Equal(t, tt.want, got)
		})
	}
}

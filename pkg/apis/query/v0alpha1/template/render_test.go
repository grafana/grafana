package template

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	apidata "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/stretchr/testify/require"
)

var nestedFieldRender = QueryTemplate{
	Title: "Test",
	Variables: []TemplateVariable{
		{
			Key: "metricName",
		},
	},
	Targets: []Target{
		{
			DataType: data.FrameTypeUnknown,
			//DataTypeVersion: data.FrameTypeVersion{0, 0},

			Variables: map[string][]VariableReplacement{
				"metricName": {
					{
						Path: "$.nestedObject.anArray[0]",
						Position: &Position{
							Start: 0,
							End:   3,
						},
					},
				},
			},
			Properties: apidata.NewDataQuery(map[string]any{
				"nestedObject": map[string]any{
					"anArray": []any{"foo", .2},
				},
			}),
		},
	},
}

var nestedFieldRenderedTargets = []Target{
	{
		DataType: data.FrameTypeUnknown,
		Variables: map[string][]VariableReplacement{
			"metricName": {
				{
					Path: "$.nestedObject.anArray[0]",
					Position: &Position{
						Start: 0,
						End:   3,
					},
				},
			},
		},
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: apidata.NewDataQuery(
			map[string]any{
				"nestedObject": map[string]any{
					"anArray": []any{"up", .2},
				},
			}),
	},
}

func TestNestedFieldRender(t *testing.T) {
	rT, err := RenderTemplate(nestedFieldRender, map[string][]string{"metricName": {"up"}})
	require.NoError(t, err)
	require.Equal(t,
		nestedFieldRenderedTargets,
		rT,
	)
}

var multiVarTemplate = QueryTemplate{
	Title: "Test",
	Variables: []TemplateVariable{
		{
			Key: "metricName",
		},
		{
			Key: "anotherMetric",
		},
	},
	Targets: []Target{
		{
			DataType: data.FrameTypeUnknown,
			//DataTypeVersion: data.FrameTypeVersion{0, 0},

			Variables: map[string][]VariableReplacement{
				"metricName": {
					{
						Path: "$.expr",
						Position: &Position{
							Start: 4,
							End:   14,
						},
					},
					{
						Path: "$.expr",
						Position: &Position{
							Start: 37,
							End:   47,
						},
					},
				},
				"anotherMetric": {
					{
						Path: "$.expr",
						Position: &Position{
							Start: 21,
							End:   34,
						},
					},
				},
			},

			Properties: apidata.NewDataQuery(map[string]any{
				"expr": "1 + metricName + 1 + anotherMetric + metricName",
			}),
		},
	},
}

var multiVarRenderedTargets = []Target{
	{
		DataType: data.FrameTypeUnknown,
		Variables: map[string][]VariableReplacement{
			"metricName": {
				{
					Path: "$.expr",
					Position: &Position{
						Start: 4,
						End:   14,
					},
				},
				{
					Path: "$.expr",
					Position: &Position{
						Start: 37,
						End:   47,
					},
				},
			},
			"anotherMetric": {
				{
					Path: "$.expr",
					Position: &Position{
						Start: 21,
						End:   34,
					},
				},
			},
		},
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: apidata.NewDataQuery(map[string]any{
			"expr": "1 + up + 1 + sloths_do_like_a_good_nap + up",
		}),
	},
}

func TestMultiVarTemplate(t *testing.T) {
	rT, err := RenderTemplate(multiVarTemplate, map[string][]string{
		"metricName":    {"up"},
		"anotherMetric": {"sloths_do_like_a_good_nap"},
	})
	require.NoError(t, err)
	require.Equal(t,
		multiVarRenderedTargets,
		rT,
	)
}

func TestRenderWithRune(t *testing.T) {
	qt := QueryTemplate{
		Variables: []TemplateVariable{
			{
				Key: "name",
			},
		},
		Targets: []Target{
			{
				Properties: apidata.NewDataQuery(map[string]any{
					"message": "🐦 name!",
				}),
				Variables: map[string][]VariableReplacement{
					"name": {
						{
							Path: "$.message",
							Position: &Position{
								Start: 2,
								End:   6,
							},
						},
					},
				},
			},
		},
	}

	selectedValues := map[string][]string{
		"name": {"🦥"},
	}

	rq, err := RenderTemplate(qt, selectedValues)
	require.NoError(t, err)

	require.Equal(t, "🐦 🦥!", rq[0].Properties.GetString("message"))
}

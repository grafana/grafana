package peakq

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1/template"
)

var nestedFieldRender = template.QueryTemplate{
	Title: "Test",
	Variables: []template.TemplateVariable{
		{
			Key: "metricName",
		},
	},
	Targets: []template.Target{
		{
			DataType: data.FrameTypeUnknown,
			//DataTypeVersion: data.FrameTypeVersion{0, 0},

			Variables: map[string][]template.VariableReplacement{
				"metricName": {
					{
						Path: "$.nestedObject.anArray[0]",
						Position: &template.Position{
							Start: 0,
							End:   3,
						},
					},
				},
			},
			Properties: query.NewGenericDataQuery(map[string]any{
				"nestedObject": map[string]any{
					"anArray": []any{"foo", .2},
				},
			}),
		},
	},
}

var nestedFieldRenderedTargets = []template.Target{
	{
		DataType: data.FrameTypeUnknown,
		Variables: map[string][]template.VariableReplacement{
			"metricName": {
				{
					Path: "$.nestedObject.anArray[0]",
					Position: &template.Position{
						Start: 0,
						End:   3,
					},
				},
			},
		},
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: query.NewGenericDataQuery(
			map[string]any{
				"nestedObject": map[string]any{
					"anArray": []any{"up", .2},
				},
			}),
	},
}

func TestNestedFieldRender(t *testing.T) {
	rT, err := template.RenderTemplate(nestedFieldRender, map[string][]string{"metricName": {"up"}})
	require.NoError(t, err)
	require.Equal(t,
		nestedFieldRenderedTargets,
		rT,
	)
}

var multiVarTemplate = template.QueryTemplate{
	Title: "Test",
	Variables: []template.TemplateVariable{
		{
			Key: "metricName",
		},
		{
			Key: "anotherMetric",
		},
	},
	Targets: []template.Target{
		{
			DataType: data.FrameTypeUnknown,
			//DataTypeVersion: data.FrameTypeVersion{0, 0},

			Variables: map[string][]template.VariableReplacement{
				"metricName": {
					{
						Path: "$.expr",
						Position: &template.Position{
							Start: 4,
							End:   14,
						},
					},
					{
						Path: "$.expr",
						Position: &template.Position{
							Start: 37,
							End:   47,
						},
					},
				},
				"anotherMetric": {
					{
						Path: "$.expr",
						Position: &template.Position{
							Start: 21,
							End:   34,
						},
					},
				},
			},

			Properties: query.NewGenericDataQuery(map[string]any{
				"expr": "1 + metricName + 1 + anotherMetric + metricName",
			}),
		},
	},
}

var multiVarRenderedTargets = []template.Target{
	{
		DataType: data.FrameTypeUnknown,
		Variables: map[string][]template.VariableReplacement{
			"metricName": {
				{
					Path: "$.expr",
					Position: &template.Position{
						Start: 4,
						End:   14,
					},
				},
				{
					Path: "$.expr",
					Position: &template.Position{
						Start: 37,
						End:   47,
					},
				},
			},
			"anotherMetric": {
				{
					Path: "$.expr",
					Position: &template.Position{
						Start: 21,
						End:   34,
					},
				},
			},
		},
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: query.NewGenericDataQuery(map[string]any{
			"expr": "1 + up + 1 + sloths_do_like_a_good_nap + up",
		}),
	},
}

func TestMultiVarTemplate(t *testing.T) {
	rT, err := Render(multiVarTemplate, map[string][]string{
		"metricName":    {"up"},
		"anotherMetric": {"sloths_do_like_a_good_nap"},
	})
	require.NoError(t, err)
	require.Equal(t,
		multiVarRenderedTargets,
		rT.Targets,
	)
}

func TestRenderWithRune(t *testing.T) {
	qt := template.QueryTemplate{
		Variables: []template.TemplateVariable{
			{
				Key: "name",
			},
		},
		Targets: []template.Target{
			{
				Properties: query.NewGenericDataQuery(map[string]any{
					"message": "🐦 name!",
				}),
				Variables: map[string][]template.VariableReplacement{
					"name": {
						{
							Path: "$.message",
							Position: &template.Position{
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

	rq, err := Render(qt, selectedValues)
	require.NoError(t, err)

	require.Equal(t, "🐦 🦥!", rq.Targets[0].Properties.AdditionalProperties()["message"])
}

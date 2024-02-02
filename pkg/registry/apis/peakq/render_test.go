package peakq

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
)

var nestedFieldRender = peakq.QueryTemplateSpec{
	Title: "Test",
	Variables: []peakq.TemplateVariable{
		{
			Key: "metricName",
		},
	},
	Targets: []peakq.Target{
		{
			DataType: data.FrameTypeUnknown,
			//DataTypeVersion: data.FrameTypeVersion{0, 0},

			Variables: map[string][]peakq.VariableReplacement{
				"metricName": {
					{
						Path: "$.nestedObject.anArray[0]",
						Position: &peakq.Position{
							Start: 0,
							End:   3,
						},
					},
				},
			},
			Properties: common.Unstructured{
				Object: map[string]any{
					"nestedObject": map[string]any{
						"anArray": []any{"foo", .2},
					},
				},
			},
		},
	},
}

var nestedFieldRenderedTargets = []peakq.Target{
	{
		DataType: data.FrameTypeUnknown,
		Variables: map[string][]peakq.VariableReplacement{
			"metricName": {
				{
					Path: "$.nestedObject.anArray[0]",
					Position: &peakq.Position{
						Start: 0,
						End:   3,
					},
				},
			},
		},
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: common.Unstructured{
			Object: map[string]any{
				"nestedObject": map[string]any{
					"anArray": []any{"up", .2},
				},
			},
		},
	},
}

func TestNestedFieldRender(t *testing.T) {
	rT, err := Render(nestedFieldRender, map[string][]string{"metricName": {"up"}})
	require.NoError(t, err)
	require.Equal(t,
		nestedFieldRenderedTargets,
		rT.Targets,
	)
}

var multiVarTemplate = peakq.QueryTemplateSpec{
	Title: "Test",
	Variables: []peakq.TemplateVariable{
		{
			Key: "metricName",
		},
		{
			Key: "anotherMetric",
		},
	},
	Targets: []peakq.Target{
		{
			DataType: data.FrameTypeUnknown,
			//DataTypeVersion: data.FrameTypeVersion{0, 0},

			Variables: map[string][]peakq.VariableReplacement{
				"metricName": {
					{
						Path: "$.expr",
						Position: &peakq.Position{
							Start: 4,
							End:   14,
						},
					},
					{
						Path: "$.expr",
						Position: &peakq.Position{
							Start: 37,
							End:   47,
						},
					},
				},
				"anotherMetric": {
					{
						Path: "$.expr",
						Position: &peakq.Position{
							Start: 21,
							End:   34,
						},
					},
				},
			},

			Properties: common.Unstructured{
				Object: map[string]any{
					"expr": "1 + metricName + 1 + anotherMetric + metricName",
				},
			},
		},
	},
}

var multiVarRenderedTargets = []peakq.Target{
	{
		DataType: data.FrameTypeUnknown,
		Variables: map[string][]peakq.VariableReplacement{
			"metricName": {
				{
					Path: "$.expr",
					Position: &peakq.Position{
						Start: 4,
						End:   14,
					},
				},
				{
					Path: "$.expr",
					Position: &peakq.Position{
						Start: 37,
						End:   47,
					},
				},
			},
			"anotherMetric": {
				{
					Path: "$.expr",
					Position: &peakq.Position{
						Start: 21,
						End:   34,
					},
				},
			},
		},
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: common.Unstructured{
			Object: map[string]any{
				"expr": "1 + up + 1 + sloths_do_like_a_good_nap + up",
			},
		},
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

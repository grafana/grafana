package peakq

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
	"github.com/stretchr/testify/require"
)

var nestedFieldRender = peakq.QueryTemplateSpec{
	Title: "Test",
	Variables: []peakq.QueryVariable{
		{
			Key: "metricName",
			Positions: map[string]map[peakq.Path][]peakq.Position{
				"0": {
					"$.nestedObject.anArray[0]": []peakq.Position{
						{
							Start: 0,
							End:   3,
						},
					},
				},
			},
		},
	},
	Targets: []peakq.Target{
		{
			DataType: data.FrameTypeUnknown,
			//DataTypeVersion: data.FrameTypeVersion{0, 0},
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
	rT, err := Render(nestedFieldRender, map[string]string{"metricName": "up"})
	require.NoError(t, err)
	require.Equal(t,
		nestedFieldRenderedTargets,
		rT.Targets,
	)
}

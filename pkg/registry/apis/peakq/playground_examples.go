package peakq

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
)

var basicTemplateWithSelectedValue = peakq.QueryTemplateSpec{
	Title: "Test",
	Variables: []peakq.QueryVariable{
		{
			Key: "metricName",
			//	SelectedValue: `up`, // TODO: Pointer or opt to "Replace on Empty"
			DefaultValue: `down`,
			Positions: []peakq.Position{
				{
					TargetIdx: 0,
					TargetKey: "expr",
					Start:     0,
					End:       10,
				},
				{
					TargetIdx: 0,
					TargetKey: "expr",
					Start:     13,
					End:       23,
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
					"refId": "A", // TODO: Set when Where?
					"datasource": map[string]any{
						"type": "prometheus",
						"uid":  "foo", // TODO: Probably a default templating thing to set this.
					},
					"editorMode": "builder",
					"expr":       "metricName + metricName + 42",
					"instant":    true,
					"range":      false,
					"exemplar":   false,
				},
			},
		},
	},
}

var basicTemplateRenderedTargets = []peakq.Target{
	{
		DataType: data.FrameTypeUnknown,
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: common.Unstructured{
			Object: map[string]any{
				"refId": "A", // TODO: Set when Where?
				"datasource": map[string]any{
					"type": "prometheus",
					"uid":  "foo", // TODO: Probably a default templating thing to set this.
				},
				"editorMode": "builder",
				"expr":       "up",
				"instant":    true,
				"range":      false,
				"exemplar":   false,
			},
		},
	},
}

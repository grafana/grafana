package peakq

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

var basicTemplateSpec = peakq.QueryTemplateSpec{
	Title: "Test",
	Variables: []peakq.TemplateVariable{
		{
			Key:           "metricName",
			DefaultValues: []string{`down`},
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
							Start: 0,
							End:   10,
						},
					},
					{
						Path: "$.expr",
						Position: &peakq.Position{
							Start: 13,
							End:   23,
						},
					},
				},
			},

			Properties: query.NewGenericDataQuery(map[string]any{
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
			}),
		},
	},
}

var basicTemplateRenderedTargets = []peakq.Target{
	{
		DataType: data.FrameTypeUnknown,
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: query.NewGenericDataQuery(map[string]any{
			"refId": "A", // TODO: Set when Where?
			"datasource": map[string]any{
				"type": "prometheus",
				"uid":  "foo", // TODO: Probably a default templating thing to set this.
			},
			"editorMode": "builder",
			"expr":       "up + up + 42",
			"instant":    true,
			"range":      false,
			"exemplar":   false,
		}),
	},
}

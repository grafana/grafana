package peakq

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
	apidata "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1/template"
)

var basicTemplateSpec = template.QueryTemplate{
	Title: "Test",
	Variables: []template.TemplateVariable{
		{
			Key:           "metricName",
			DefaultValues: []string{`down`},
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
							Start: 0,
							End:   10,
						},
					},
					{
						Path: "$.expr",
						Position: &template.Position{
							Start: 13,
							End:   23,
						},
					},
				},
			},

			Properties: apidata.NewDataQuery(map[string]any{
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

var basicTemplateRenderedTargets = []template.Target{
	{
		DataType: data.FrameTypeUnknown,
		//DataTypeVersion: data.FrameTypeVersion{0, 0},
		Properties: apidata.NewDataQuery(map[string]any{
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

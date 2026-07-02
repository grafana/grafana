package checks

import "testing"

func TestRender(t *testing.T) {
	tests := []struct {
		name     string
		template string
		args     map[string]string
		links    map[string]string
		want     string
	}{
		{
			name:     "empty template",
			template: "",
			want:     "",
		},
		{
			name:     "no placeholders",
			template: "Follow the documentation for each element.",
			want:     "Follow the documentation for each element.",
		},
		{
			name:     "single arg",
			template: "Panel stops working in Grafana {{version}}.",
			args:     map[string]string{"version": "13.1"},
			want:     "Panel stops working in Grafana 13.1.",
		},
		{
			name:     "multiple args, one repeated",
			template: "use '{{amazonID}}' or '{{azureID}}' (see {{amazonID}} docs).",
			args: map[string]string{
				"amazonID": "grafana-amazonprometheus-datasource",
				"azureID":  "grafana-azureprometheus-datasource",
			},
			want: "use 'grafana-amazonprometheus-datasource' or 'grafana-azureprometheus-datasource' (see grafana-amazonprometheus-datasource docs).",
		},
		{
			name:     "single link",
			template: "Check <docs>the documentation</docs> for details.",
			links:    map[string]string{"docs": "https://grafana.com/docs"},
			want:     `Check <a href="https://grafana.com/docs" target="_blank" rel="noopener noreferrer">the documentation</a> for details.`,
		},
		{
			name:     "two different links",
			template: "See <docs>docs</docs> or open a <support>ticket</support>.",
			links: map[string]string{
				"docs":    "https://grafana.com/docs",
				"support": "https://grafana.com/support",
			},
			want: `See <a href="https://grafana.com/docs" target="_blank" rel="noopener noreferrer">docs</a> or open a <a href="https://grafana.com/support" target="_blank" rel="noopener noreferrer">ticket</a>.`,
		},
		{
			name:     "args and links combined",
			template: "Grafana {{version}} deprecates SceneViewer. See <docs>version support</docs>.",
			args:     map[string]string{"version": "13.1"},
			links:    map[string]string{"docs": "https://grafana.com/docs/version-support"},
			want:     `Grafana 13.1 deprecates SceneViewer. See <a href="https://grafana.com/docs/version-support" target="_blank" rel="noopener noreferrer">version support</a>.`,
		},
		{
			name:     "unknown link tag left as-is",
			template: "See <mystery>this</mystery>.",
			links:    map[string]string{"docs": "https://grafana.com/docs"},
			want:     "See <mystery>this</mystery>.",
		},
		{
			name:     "unknown arg left as-is",
			template: "Value is {{missing}}.",
			args:     map[string]string{"other": "x"},
			want:     "Value is {{missing}}.",
		},
		{
			name:     "URL is quoted so quotes in URLs escape",
			template: `Check <docs>docs</docs>.`,
			links:    map[string]string{"docs": `https://example.com/?q="foo"`},
			// %q escapes the inner quotes, producing a valid HTML attribute value.
			want: `Check <a href="https://example.com/?q=\"foo\"" target="_blank" rel="noopener noreferrer">docs</a>.`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Render(tt.template, tt.args, tt.links)
			if got != tt.want {
				t.Errorf("Render(...) mismatch\ngot:  %s\nwant: %s", got, tt.want)
			}
		})
	}
}

export const alertsLoopSnippet = `
{{ range .Alerts }}
  Status: {{ .Status }}
  Starts at: {{ .StartsAt }}
{{ end }}
`;

export const alertDetailsSnippet = `
[{{.Status}}] {{ .Labels.alertname }}

Labels:
{{ range .Labels.SortedPairs }}
  {{ .Name }}: {{ .Value }}
{{ end }}

{{ if gt (len .Annotations) 0 }}
Annotations:
{{ range .Annotations.SortedPairs }}
  {{ .Name }}: {{ .Value }}
{{ end }}
{{ end }}

{{ if gt (len .SilenceURL ) 0 }}
  Silence alert: {{ .SilenceURL }}
{{ end }}
{{ if gt (len .DashboardURL ) 0 }}
  Go to dashboard: {{ .DashboardURL }}
{{ end }}
`;

export const jsonSnippet = `
{{ coll.Dict
  "receiver" .Receiver
  "status" .Status
  "alerts" ( len .Alerts )
| data.ToJSONPretty " " }}
`;

export const groupLabelsLoopSnippet = getKeyValueTemplate('GroupLabels.SortedPairs');
export const commonLabelsLoopSnippet = getKeyValueTemplate('CommonLabels.SortedPairs');
export const commonAnnotationsLoopSnippet = getKeyValueTemplate('CommonAnnotations.SortedPairs');
export const labelsLoopSnippet = getKeyValueTemplate('Labels.SortedPairs');
export const annotationsLoopSnippet = getKeyValueTemplate('Annotations.SortedPairs');

function getKeyValueTemplate(arrayName: string) {
  return `
{{ range .${arrayName} }}
  {{ .Name }} = {{ .Value }}
{{ end }}`;
}

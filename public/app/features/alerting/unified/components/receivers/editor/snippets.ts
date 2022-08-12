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

export const groupLabelsLoopSnippet = getKeyValueTemplate('GroupLabels');
export const commonLabelsLoopSnippet = getKeyValueTemplate('GroupLabels');
export const commonAnnotationsLoopSnippet = getKeyValueTemplate('GroupLabels');
export const labelsLoopSnippet = getKeyValueTemplate('GroupLabels');
export const annotationsLoopSnippet = getKeyValueTemplate('GroupLabels');

function getKeyValueTemplate(arrayName: string) {
  return `
{{ range .${arrayName} }}
  {{ .Name }} = {{ .Value }}
{{ end }}`;
}

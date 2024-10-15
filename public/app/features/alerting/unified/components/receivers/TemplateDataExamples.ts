export interface TemplateExampleItem {
  description: string;
  example: string;
}

export const GlobalTemplateDataExamples: TemplateExampleItem[] = [
  {
    description: 'Default template for titles',
    example: `{{ define "copy_default.title" }}
    [{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ if gt (.Alerts.Resolved | len) 0 }}, RESOLVED:{{ .Alerts.Resolved | len }}{{ end }}{{ end }}] {{ .GroupLabels.SortedPairs.Values | join " " }} {{ if gt (len .CommonLabels) (len .GroupLabels) }}({{ with .CommonLabels.Remove .GroupLabels.Names }}{{ .Values | join " " }}{{ end }}){{ end }}
{{ end }}`,
  },
  {
    description: 'Default template for messages',
    example: `{{ define "copy_default.message" }}{{ if gt (len .Alerts.Firing) 0 }}**Firing**
{{ template "print_alert_list" .Alerts.Firing }}{{ if gt (len .Alerts.Resolved) 0 }}

{{ end }}{{ end }}{{ if gt (len .Alerts.Resolved) 0 }}**Resolved**
{{ template "print_alert_list" .Alerts.Resolved }}{{ end }}{{ end }}`,
  },
  {
    description: 'Print alerts with summary and description',
    example: `{{ define "Table" }}
{{- "\nHost\t\tValue\n" -}}
{{ range .Alerts -}}
{{ range .Annotations.SortedPairs -}}
{{ if (eq .Name  "ServerInfo") -}}
{{ .Value -}}
{{- end }}
{{- end }}
{{- end }}
{{ end }}`,
  },
  {
    description: 'Print firing and resolved alerts',
    example: `{{ define "my_conditional_notification" }}
{{ if eq .CommonLabels.namespace "namespace-a" }}
Alert: CPU limits have reached 80% in namespace-a.
{{ else if eq .CommonLabels.namespace "namespace-b" }}
Alert: CPU limits have reached 80% in namespace-b.
{{ else if eq .CommonLabels.namespace "namespace-c" }}
Alert: CPU limits have reached 80% in namespace-c.
{{ else }}
Alert: CPU limits have reached 80% for {{ .CommonLabels.namespace }} namespace.
{{ end }}
{{ end }}`,
  },
  {
    description: 'Print individual labels and annotations',
    example: `{{ define "slack.title" }}
{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
{{ end }}`,
  },
  {
    description: 'Print common labels and common annotations',
    example: `{{ define "slack.print_alert" -}}
[{{.Status}}] {{ .Labels.alertname }}
Labels:
{{ range .Labels.SortedPairs -}}
- {{ .Name }}: {{ .Value }}
{{ end -}}
{{ if .Annotations -}}
Annotations:
{{ range .Annotations.SortedPairs -}}
- {{ .Name }}: {{ .Value }}
{{ end -}}
{{ end -}}
{{ if .SilenceURL -}}
Silence: {{ .SilenceURL }}
{{ end -}}
{{ if .DashboardURL -}}
Go to dashboard: {{ .DashboardURL }}
{{- end }}
{{- end }}`,
  },
  {
    description: 'Print runbook and Grafana URLs',
    example: `{{ define "common.subject_title" }}
{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
{{ end }}`,
  },
];

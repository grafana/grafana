export interface TemplateExampleItem {
  description: string;
  example: string;
}

export const GlobalTemplateDataExamples: TemplateExampleItem[] = [
  {
    description: 'Default templates for notification titles',
    example: `{{- /* This is a copy of the "default.title" template. */ -}}
{{- /* Edit the template name and template content as needed. */ -}}
{{ define "default.title.copy" }}
  [{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ if gt (.Alerts.Resolved | len) 0 }}, RESOLVED:{{ .Alerts.Resolved | len }}{{ end }}{{ end }}] {{ .GroupLabels.SortedPairs.Values | join " " }} {{ if gt (len .CommonLabels) (len .GroupLabels) }}({{ with .CommonLabels.Remove .GroupLabels.Names }}{{ .Values | join " " }}{{ end }}){{ end }}
{{ end }}`,
  },
  {
    description: 'Default templates for notification messages',
    example: `{{- /* This is a copy of the "default.message" template. */ -}}
{{- /* Edit the template name and template content as needed. */ -}}
{{ define "default.message.copy" }}{{ if gt (len .Alerts.Firing) 0 }}**Firing**
{{ template "__text_alert_list.copy" .Alerts.Firing }}{{ if gt (len .Alerts.Resolved) 0 }}

{{ end }}{{ end }}{{ if gt (len .Alerts.Resolved) 0 }}**Resolved**
{{ template "__text_alert_list.copy" .Alerts.Resolved }}{{ end }}{{ end }}

{{ define "__text_alert_list.copy" }}{{ range . }}
Value: {{ template "__text_values_list.copy" . }}
Labels:
{{ range .Labels.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}Annotations:
{{ range .Annotations.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}{{ if gt (len .GeneratorURL) 0 }}Source: {{ .GeneratorURL }}
{{ end }}{{ if gt (len .SilenceURL) 0 }}Silence: {{ .SilenceURL }}
{{ end }}{{ if gt (len .DashboardURL) 0 }}Dashboard: {{ .DashboardURL }}
{{ end }}{{ if gt (len .PanelURL) 0 }}Panel: {{ .PanelURL }}
{{ end }}{{ end }}{{ end }}

{{ define "__text_values_list.copy" }}{{ if len .Values }}{{ $first := true }}{{ range $refID, $value := .Values -}}
{{ if $first }}{{ $first = false }}{{ else }}, {{ end }}{{ $refID }}={{ $value }}{{ end -}}
{{ else }}[no value]{{ end }}{{ end }}`,
  },
  {
    description: 'Print alerts with summary and description',
    example: `{{- /* Example displaying the summary and description annotations of each alert in the notification. */ -}}
{{- /* Edit the template name and template content as needed. */ -}}
{{ define "custom.alerts" -}}
{{ len .Alerts }} alert(s)
{{ range .Alerts -}}
  {{ template "alert.summary_and_description" . -}}
{{ end -}}
{{ end -}}

{{ define "alert.summary_and_description" }}
  Summary: {{.Annotations.summary}}
  Status: {{ .Status }}
  Description: {{.Annotations.description}}
{{ end -}}`,
  },
  {
    description: 'Print firing and resolved alerts',
    example: `{{- /* Example displaying firing and resolved alerts separately in the notification. */ -}}
{{- /* Edit the template name and template content as needed. */ -}}
{{ define "custom.firing_and_resolved_alerts" -}}
{{ len .Alerts.Resolved }} resolved alert(s)
{{ range .Alerts.Resolved -}}
  {{ template "alert.summary_and_description" . -}}
{{ end }}
{{ len .Alerts.Firing }} firing alert(s)
{{ range .Alerts.Firing -}}
  {{ template "alert.summary_and_description" . -}}
{{ end -}}
{{ end -}}

{{ define "alert.summary_and_description" }}
  Summary: {{.Annotations.summary}}
  Status: {{ .Status }}
  Description: {{.Annotations.description}}
{{ end -}}`,
  },
  {
    description: 'Print common labels and annotations',
    example: `{{- /* Example displaying labels and annotations that are common to all alerts in the notification.*/ -}}
{{- /* Edit the template name and template content as needed. */ -}}
{{ define "custom.common_labels_and_annotations" -}}
{{ len .Alerts.Resolved }} resolved alert(s)
{{ len .Alerts.Firing }} firing alert(s)

Common labels: {{ len .CommonLabels.SortedPairs }}
{{ range .CommonLabels.SortedPairs -}}
- {{ .Name }} = {{ .Value }}
{{ end }}

Common annotations: {{ len .CommonAnnotations.SortedPairs }}
{{ range .CommonAnnotations.SortedPairs }}
- {{ .Name }} = {{ .Value }}
{{ end }}

{{ end -}}`,
  },
  {
    description: 'Print individual labels and annotations',
    example: `{{- /* Example displaying all labels and annotations for each alert in the notification.*/ -}}
{{- /* Edit the template name and template content as needed. */ -}}
{{ define "custom.alert_labels_and_annotations" -}}
{{ len .Alerts.Resolved }} resolved alert(s)
{{ range .Alerts.Resolved -}}
  {{ template "alert.labels_and_annotations" . -}}
{{ end }}
{{ len .Alerts.Firing }} firing alert(s)
{{ range .Alerts.Firing -}}
  {{ template "alert.labels_and_annotations" . -}}
{{ end -}}
{{ end -}}

{{ define "alert.labels_and_annotations" }}
Alert labels: {{ len .Labels.SortedPairs }}
{{ range .Labels.SortedPairs -}}
- {{ .Name }} = {{ .Value }}
{{ end -}}
Alert annotations: {{ len .Annotations.SortedPairs }}
{{ range .Annotations.SortedPairs -}}
- {{ .Name }} = {{ .Value }}
{{ end -}}
{{ end -}}`,
  },
  {
    description: 'Print URLs for runbook and alert data in Grafana',
    example: `{{- /* Example displaying additional information, such as runbook link, DashboardURL and SilenceURL, for each alert in the notification.*/ -}}
{{- /* Edit the template name and template content as needed. */ -}}
{{ define "custom.alert_additional_details" -}}
{{ len .Alerts.Resolved }} resolved alert(s)
{{ range .Alerts.Resolved -}}
  {{ template "alert.additional_details" . -}}
{{ end }}
{{ len .Alerts.Firing }} firing alert(s)
{{ range .Alerts.Firing -}}
  {{ template "alert.additional_details" . -}}
{{ end -}}
{{ end -}}

{{ define "alert.additional_details" }}
- Dashboard: {{ .DashboardURL }}
- Panel: {{ .PanelURL }}
- AlertGenerator: {{ .GeneratorURL }}
- Silence: {{ .SilenceURL }}
- RunbookURL: {{ .Annotations.runbook_url}}
{{ end -}}`,
  },
];

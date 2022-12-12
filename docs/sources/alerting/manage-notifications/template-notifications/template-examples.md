---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
  - example templates
title: Template examples
weight: 500
---

# Template examples

Here are number of more complex examples to use as a reference for customizing your notifications.

## Template the subject of an email

Here is an example of templating the subject of an email with the text **1 firing alert(s), 0 resolved alerts(s)**:

```
{{ define "email.subject" }}
{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
{{ end }}
```

Here is an example of a template where the subject shows the number of firing and resolved alerts if the number is more than 0. For example, when the notification contains just firing alerts the subject will be **1 firing alert(s)**, when the notification contains just resolved alerts the subject will be **1 resolved alert(s)**, and when the notification contains both firing and resolved alerts the subject will be **1 firing alert(s) 1 resolved alerts**:

```
{{ define "email.subject" }}
{{ if .Alerts.Firing -}}
{{ len .Alerts.Firing }} firing alert(s)
{{ end }}
{{ if .Alerts.Firing -}}
{{ len .Alerts.Resolved }} resolved alert(s)
{{ end }}
{{ end }}
```

## Template the message of an email

Here is an example of an email with the following message:

```
There are 2 firing alert(s), and 1 resolved alert(s)

Firing alerts:

- alertname=Test 1 grafana_folder=GrafanaCloud has value(s) B=1
- alertname=Test 2 grafana_folder=GrafanaCloud has value(s) B=2

Resolved alerts:

- alertname=Test 3 grafana_folder=GrafanaCloud has value(s) B=0
```

The message is created from two templates: `email.message_alert` and `email.message`. The `email.message_alert` template is used to print the labels and values for each firing and resolved alert while the `email.message` template contains the structure of the email.

```
{{- define "email.message_alert" -}}
{{- range .Labels.SortedPairs }}{{ .Name }}={{ .Value }} {{ end }} has value(s)
{{- range $k, $v := .Values }} {{ $k }}={{ $v }}{{ end }}
{{- end -}}

{{ define "email.message" }}
There are {{ len .Alerts.Firing }} firing alert(s), and {{ len .Alerts.Resolved }} resolved alert(s)

{{ if .Alerts.Firing -}}
Firing alerts:
{{- range .Alerts.Firing }}
- {{ template "email.message_alert" . }}
{{- end }}
{{- end }}

{{ if .Alerts.Resolved -}}
Resolved alerts:
{{- range .Alerts.Resolved }}
- {{ template "email.message_alert" . }}
{{- end }}
{{- end }}

{{ end }}
```

## Template labels, annotations, SilenceURL and DashboardURL of all alerts

Here is an example of another notification with the following message:

```
1 firing alert(s):

[firing] Test1
Labels:
- alertname: Test1
- grafana_folder: GrafanaCloud
Annotations:
- description: This is a test alert
Silence: https://example.com/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DTest1&matcher=grafana_folder%3DGrafanaCloud
Go to dashboard: https://example.com/d/dlhdLqF4z?orgId=1

1 resolved alert(s):

[firing] Test2
Labels:
- alertname: Test2
- grafana_folder: GrafanaCloud
Annotations:
- description: This is another test alert
Silence: https://example.com/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DTest2&matcher=grafana_folder%3DGrafanaCloud
Go to dashboard: https://example.com/d/dlhdLqF4z?orgId=1
```

The message is created from two templates: `custom.print_alert` and `custom.message`. The `custom.print_alert` template is used to print the labels, annotations, SilenceURL and DashboardURL while the `custom.message` template contains the structure of the notification.

```
{{ define "custom.print_alert" -}}
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
{{- end }}

{{ define "custom.message" -}}
{{ if .Alerts.Firing -}}
{{ len .Alerts.Firing }} firing alert(s):
{{ range .Alerts.Firing }}
{{ template "custom.print_alert" . }}
{{ end -}}
{{ end }}
{{ if .Alerts.Resolved -}}
{{ len .Alerts.Resolved }} resolved alert(s):
{{ range .Alerts.Resolved }}
{{ template "custom.print_alert" .}}
{{ end -}}
{{ end }}
{{- end }}
```

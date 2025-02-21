---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/
description: Examples of notification templates
keywords:
  - grafana
  - alerting
  - templating
  - notification templates
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Notification template examples
menuTitle: Examples
weight: 103
refs:
  template-annotations-and-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/
  template-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
  manage-notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/manage-notification-templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/manage-notification-templates/
  reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/
  reference-notification-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/#notification-data
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/#notification-data
  reference-alert:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/#alert
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/#alert
  language:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/language/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/language/
  group-alert-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/
---

# Notification template examples

Notification templates allows you to change the default notification messages.

You can modify the content and format of notification messages. For example, you can customize the content to show only specific information or adjust the format to suit a particular contact point, such as Slack or Email.

{{% admonition type="note" %}}
Avoid adding extra information about alert instances in notification templates, as this information is only visible in the notification message.

Instead, you should [use annotations or labels](ref:template-annotations-and-labels) to add information directly to the alert, ensuring it's also visible in the alert state and alert history within Grafana. You can then print the new alert annotation or label in notification templates.
{{% /admonition %}}

This page provides various examples illustrating how to template common notification messages. For more details about notification templates, refer to:

- [Template notifications](ref:template-notifications)
- [Select, create, and preview a notification template](ref:manage-notification-templates)
- [Notification template reference](ref:reference)

## Basic examples

Notification templates can access the [notification data](ref:reference-notification-data) using the dot (`.`). The following examples demonstrate some basic uses of the [template language](ref:language).

For instance, to check if there are common labels (`.CommonLabels`) for all alerts in the notification, use `if`:

```go
{{ define "custom_message" -}}
{{ if .CommonLabels }}
Alerts have common labels
{{ else }}
There are no common labels
{{ end }}
{{ end }}
```

To iterate on the alerts in the notification and print a specific label, use `range` and `index`:

```go
{{ define "custom_message" -}}
{{ range .Alerts }}
The name of the alert is {{ index .Labels "alertname" }}
{{ end }}
{{ end }}
```

Alternatively, you can use the `.` notation to print the value of the key.

```go
{{ define "custom_message" -}}
{{ range .Alerts }}
The name of the alert is {{ .Labels.alertname }}
{{ end }}
{{ end }}
```

You can then use the template by passing the [notification data (dot `.`)](ref:reference-notification-data):

```go
{{ template "custom_message" . }}
```

```template_output
The name of the alert is InstanceDown

The name of the alert is CpuOverload
```

## Print alerts with summary and description

Here's an example that displays the summary and description annotations for each alert in the notification.

```go
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
{{ end -}}
```

In this example:

- A template (`alert.summary_and_description`) is defined to print the `summary`, `status`, and `description` of one [alert](ref:reference-alert).
- The main template `custom.alerts` iterates the list of alerts (`.Alerts`) in [notification data](ref:reference-notification-data), executing the `alert.summary_and_description` template to print the details of each alert.

Execute the template by passing the dot (`.`):

```go
{{ template "custom.alerts" . }}
```

```template_output
2 alert(s)

  Summary: The database server db1 has exceeded 75% of available disk space.
  Status: firing
  Description: This alert fires when a database server is at risk of running out of disk space. You should take measures to increase the maximum available disk space as soon as possible to avoid possible corruption.

  Summary: The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes.
  Status: resolved
  Description: This alert fires when a web server responds with more 5xx errors than is expected. This could be an issue with the web server or a backend service.
```

## Print firing and resolved alerts

The following example is similar to the previous one, but it separates firing and resolved alerts.

```go
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
{{ end -}}
```

Instead of `.Alerts`, the template accesses `.Alerts.Firing` and `.Alerts.Resolved` separately to print details for each alert.

Run the template by passing the dot (`.`):

```go
{{ template "custom.firing_and_resolved_alerts" . }}
```

```template_output
1 resolved alert(s)

  Summary: The database server db1 has exceeded 75% of available disk space.
  Status: resolved
  Description: This alert fires when a database server is at risk of running out of disk space. You should take measures to increase the maximum available disk space as soon as possible to avoid possible corruption.

1 firing alert(s)

  Summary: The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes.
  Status: firing
  Description: This alert fires when a web server responds with more 5xx errors than is expected. This could be an issue with the web server or a backend service.
```

## Print common labels and annotations

This example displays only the labels and annotations that are common to all alerts in the notification.

```go
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
{{ end -}}
```

Note that `.CommonAnnotations` and `.CommonLabels` are part of [notification data](ref:reference-notification-data).

Execute the template by passing the dot (`.`) as argument:

```go
{{ template "custom.common_labels_and_annotations" . }}
```

```template_output
1 resolved alert(s)
1 firing alert(s)
Common labels: 2
- grafana_folder = server_alerts
- team = server_admin

Common annotations: 0
```

## Print individual labels and annotations

This example displays all labels and annotations for each [alert](ref:reference-alert) in the notification.

```go
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
{{ end -}}
```

In this example:

- The `custom.alert_labels_and_annotations` template iterates over the list of resolved and firing alerts, similar to previous examples. It then executes `alert.labels_and_annotations` for each alert.
- The `alert.labels_and_annotations` template prints all the alert labels and annotations by accessing `.Labels.SortedPairs` and `.Annotations.SortedPairs`.

Run the template by passing the dot (`.`):

```go
{{ template "custom.alert_labels_and_annotations" . }}
```

```template_output
1 resolved alert(s)

Alert labels: 4
- alertname = db_server_disk_space
- grafana_folder = server_alerts
- server = db1
- team = server_admin

Alert annotations: 2
- summary = The database server db1 has exceeded 75% of available disk space.
- description = This alert fires when a database server is at risk of running out of disk space. You should take measures to increase the maximum available disk space as soon as possible to avoid possible corruption.

1 firing alert(s)

Alert labels: 4
- alertname = web_server_http_errors
- grafana_folder = server_alerts
- server = web1
- team = server_admin

Alert annotations: 2
- summary = The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes.
- description = This alert fires when a web server responds with more 5xx errors than is expected. This could be an issue with the web server or a backend service.
```

## Print URLs for runbook and alert data in Grafana

Note that the following example works only for Grafana-managed alerts. It displays some [alert data](ref:reference-alert) such as `DashboardURL`, `PanelURL`, and `SilenceURL`, which are exclusive to Grafana-managed alerts.

```go
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
{{ end -}}
```

Pass the dot (`.`) to execute the template:

```go
{{ template "custom.alert_additional_details" . }}
```

```template_output
1 resolved alert(s)

- Dashboard: https://example.com/d/
- Panel: https://example.com/d/
- AlertGenerator: ?orgId=1
- Silence: https://example.com/alerting/silence/new
- RunbookURL: https://example.com/on-call/db_server_disk_space

1 firing alert(s)

- Dashboard: https://example.com/d/
- Panel: https://example.com/d/
- AlertGenerator: ?orgId=1
- Silence: https://example.com/alerting/silence/new
- RunbookURL: https://example.com/on-call/web_server_http_errors
```

## Print a notification title or subject

A title or subject provides a one-line summary of the notification content.

Here’s a basic example that displays the number of firing and resolved alerts in the notification.

```go
{{ define "custom_title" -}}
{{ if gt (.Alerts.Firing | len) 0 }}🚨 {{ .Alerts.Firing | len }} firing alerts. {{ end }}{{ if gt (.Alerts.Resolved | len) 0 }}✅ {{ .Alerts.Resolved | len }} resolved alerts.{{ end }}
{{ end -}}
```

Execute the template by passing the dot (`.`) as argument:

```go
{{ template "custom_title" . }}
```

```template_output
🚨 1 firing alerts. ✅ 1 resolved alerts.
```

The next example is a copy of the default title/subject template used in Grafana.

```go
{{ define "copy_of_default_title" -}}
[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ if gt (.Alerts.Resolved | len) 0 }}, RESOLVED:{{ .Alerts.Resolved | len }}{{ end }}{{ end }}] {{ .GroupLabels.SortedPairs.Values | join " " }} {{ if gt (len .CommonLabels) (len .GroupLabels) }}({{ with .CommonLabels.Remove .GroupLabels.Names }}{{ .Values | join " " }}{{ end }}){{ end }}
{{ end }}
```

This is a more advanced example:

- Prints the number of firing and resolved alerts in the notification.
- Outputs `.GroupLabels`, the labels used to [group multiple alerts in one notification](ref:group-alert-notifications).
- Prints `CommonLabels`, excluding labels in `.GroupLabels`.

Execute the template by passing the dot (`.`):

```go
{{ template "copy_of_default_title" . }}
```

```template_output
[FIRING:1, RESOLVED:1] api warning (sql_db)
```

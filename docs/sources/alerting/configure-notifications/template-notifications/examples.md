---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/
description: Lorem Ipsum -- List of examples templating alert rule annotations and labels
keywords:
  - grafana
  - alerting
  - templating
  - labels
  - annotations
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Notification template examples
menuTitle: Examples
weight: 103
refs:
  manage-notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/manage-notification-templates/#create-a-notification-template
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/manage-notification-templates/#create-a-notification-template
  template-language:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/language/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/language/
  language-dot:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/language/
    - pattern: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/language/
  language-range:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/language/#range
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/language/#range
  reference-extended-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/#extendeddata
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/#extendeddata
---

# Notification template examples

This document is a compilation of common use cases for templating within Grafana notification templates. Templating in notification templates allows you to dynamically customize the title, message, and format of alert notifications. The template can dynamically insert relevant information—such as alert labels, metrics, and values—into your notifications. Moreover, notification templates can be easily reused across contact points.

Each example provided here applies specifically to notification templates (note that the syntax and behavior may differ from alert rule templating). For examples related to templating within alert rules, please refer to the [labels and annotations template examples](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/) document.

> Find step-by-step instructions on [how to create notification templates](ref:manage-notification-templates) for more detailed guidance.

## Examples utilizing templating constructs and functions

This first collection of examples showcase the main templating elements that you can use to customize alert notifications.

### The index function

To print a specific annotation or label use the `index` function.

```
{{ range .Alerts }}
The name of the alert is {{ index .Labels "alertname" }}
{{ end }}
```

### If statements

You can use if statements in templates. For example, to print `There are no alerts` if there are no alerts in `.Alerts` you would write the following:

```
{{ if .Alerts }}
There are alerts
{{ else }}
There are no alerts
{{ end }}
```

### With

With is similar to if statements, however unlike if statements, `with` updates dot to refer to the value of the with:

```
{{ with .Alerts }}
There are {{ len . }} alert(s)
{{ else }}
There are no alerts
{{ end }}
```

### Variables

Variables in text/template must be created within the template. For example, to create a variable called `$variable` with the current value of dot you would write the following:

```
{{ $variable := . }}
```

You can use `$variable` inside a range or `with` and it will refer to the value of dot at the time the variable was defined, not the current value of dot.

```
{{ range .Alerts }}
{{ $alert := . }}
{{ range .Labels.SortedPairs }}
{{ .Name }} = {{ .Value }}
There are {{ len $alert.Labels }}
{{ end }}
{{ end }}
```

### Iterate over alerts

To print just the labels of each alert, rather than all information about the alert, you can use a `range` to iterate the alerts, which is initialized with the data listed in [ExtendedData](ref:reference-notification-data).

```
{{ range .Alerts }}
{{ .Labels }}
{{ end }}
```

Used functions and syntax:

- [`{{ range }}`](ref:language-range): Introduces looping through alerts to display multiple instances.
- [ExtendedData](ref:reference-extended-data): the data that the [dot](ref:language-dot) cursor is initialized with.

### Iterate over annotations and labels

This template iterates over each alert and its associated labels and annotations. It formats the output to display the name and value of each label and annotation.

```
{{ range .Alerts }}
{{ range .Labels.SortedPairs }}
The name of the label is {{ .Name }}, and the value is {{ .Value }}
{{ end }}
{{ range .Annotations.SortedPairs }}
The name of the annotation is {{ .Name }}, and the value is {{ .Value }}
{{ end }}
{{ end }}
```

Used functions and syntax:

- `Outer Range`: `{{ range .Alerts }}` iterates over each alert in the list.
- `.Labels`: The inner range `{{ range .Labels.SortedPairs }}` accesses each label, printing its name and value.
- `.Annotations`: A similar inner range for annotations prints their names and values.

### Range with index

You can get the index of each alert within a range by defining index and value variables at the start of the range:

```
{{ $num_alerts := len .Alerts }}
{{ range $index, $alert := .Alerts }}
This is alert {{ $index }} out of {{ $num_alerts }}
{{ end }}
```

## Common use cases

Below are some examples that address common use cases and some of the different approaches you can take with templating. If you are unfamiliar with the templating language, check the [language page](ref:template-language). 

> Note that some notification template examples make reference to [annotations](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/annotation-label/#annotations). The alert rule provides the annotation, while the notification template formats and sends it. Both must be configured for the notification to work. See more details in the [Create notification templates](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/create-notification-templates/#create-notification-templates) page.

### Listing multiple alert instances in a single notification

When multiple alerts are fired, a notification template can summarize affected instances, making it easier to track issues like high CPU usage across systems. For example, use this template to list all instances with high CPU usage when multiple alerts fire at once:

```go
{{ define "default.message" }}
The following instances have high CPU usage:
{{ range .Alerts.Firing }}
  - Instance: {{ .Labels.instance }}, CPU Usage: {{ .Values.A }}%
{{ end }}
{{ end }}
```

This would print:

```
The following instances have high CPU usage:
- Instance: est-03, CPU Usage: 79%
- Instance: wst-02, CPU Usage: 74%
```

### Firing and resolved alerts, with summary annotation

This template prints the summary of all firing and resolved alerts. It requires a summary annotation in each alert. More details in the [Notification templates examples](#notification-template-examples) section.

```
{{ define "alerts.message" -}}
{{ if .Alerts.Firing -}}
{{ len .Alerts.Firing }} firing alert(s)
{{ template "alerts.summarize" .Alerts.Firing }}
{{- end }}
{{- if .Alerts.Resolved -}}
{{ len .Alerts.Resolved }} resolved alert(s)
{{ template "alerts.summarize" .Alerts.Resolved }}
{{- end }}
{{- end }}

{{ define "alerts.summarize" -}}
{{ range . -}}
- {{ index .Annotations "summary" }}
{{ end }}
{{ end }}
```

The output of this template looks like this:

```
1 firing alert(s)
- The database server db1 has exceeded 75% of available disk space. Disk space used is 76%, please resize the disk size within the next 24 hours

1 resolved alert(s)
- The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes
```

### Firing and resolved alerts, with summary, description, and runbook URL

This template shows the summary, the description, and the runbook URL of all firing and resolved alerts. The Description and Runbook URL are optional and are omitted if absent from the alert. It requires a summary annotation in each alert.

```
{{ define "alerts.message" -}}
{{ if .Alerts.Firing -}}
{{ len .Alerts.Firing }} firing alert(s)
{{ template "alerts.summarize_large" .Alerts.Firing }}
{{- end }}
{{- if .Alerts.Resolved -}}
{{ len .Alerts.Resolved }} resolved alert(s)
{{ template "alerts.summarize_large" .Alerts.Resolved }}
{{- end }}
{{- end }}

{{ define "alerts.summarize_large" -}}
{{ range . }}
Summary: {{ index .Annotations "summary" }}
{{- if index .Annotations "description" }}
Description: {{ index .Annotations "description" }}{{ end }}
{{- if index .Annotations "runbook_url" }}
Runbook: {{ index .Annotations "runbook_url" }}{{ end }}
{{ end }}
{{ end }}
```

The output of this template looks like this:

```
1 firing alert(s)
Summary: The database server db1 has exceeded 75% of available disk space. Disk space used is 76%, please resize the disk size within the next 24 hours
Description: This alert fires when a database server is at risk of running out of disk space. You should take measures to increase the maximum available disk space as soon as possible to avoid possible corruption.
Runbook: https://example.com/on-call/database_server_high_disk_usage

1 resolved alert(s)
Summary: The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes
Description: This alert fires when a web server responds with more 5xx errors than is expected. This could be an issue with the web server or a backend service. Please refer to the runbook for more information.
Runbook: https://example.com/on-call/web_server_high_5xx_rate
```

### Firing and resolved alerts, with labels, summary, and silencing

This template example prints the summary annotation, and then links to both silence the alert and show in the alert in Grafana. It requires a summary annotation in each alert.

```
{{ define "alerts.message" -}}
{{ if .Alerts.Firing -}}
{{ len .Alerts.Firing }} firing alert(s)
{{ template "alerts.summarize_with_links" .Alerts.Firing }}
{{- end }}
{{- if .Alerts.Resolved -}}
{{ len .Alerts.Resolved }} resolved alert(s)
{{ template "alerts.summarize_with_links" .Alerts.Resolved }}
{{- end }}
{{- end }}

{{ define "alerts.summarize_with_links" -}}
{{ range . -}}
{{ range $k, $v := .Labels }}{{ $k }}={{ $v }} {{ end }}
{{ index .Annotations "summary" }}
{{- if eq .Status "firing" }}
- Silence this alert: {{ .SilenceURL }}{{ end }}
- View on Grafana: {{ .GeneratorURL }}
{{ end }}
{{ end }}
```

The output of this template looks like this:

```
1 firing alert(s):
alertname=database_high_disk_usage server=db1
The database server db1 has exceeded 75% of available disk space. Disk space used is 76%, please resize the disk size within the next 24 hours
- Silence this alert: https://example.com/grafana/alerting/silence/new
- View on Grafana: https://example.com/grafana/alerting/grafana/view

1 resolved alert(s):
alertname=web_server_high_5xx_rate server=web1
The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes
- View on Grafana: https://example.com/grafana/alerting/grafana/view
```

### Conditional template

Template alert notifications based on a label. In this example the label represents a namespace.

Use the following code in your notification template to display different messages based on the namespace:

   ```go
   {{ define "my_conditional_notification" }}
   {{ if eq .CommonLabels.namespace "namespace-a" }}
   Alert: CPU limits have reached 80% in namespace-a.
   {{ else if eq .CommonLabels.namespace "namespace-b" }}
   Alert: CPU limits have reached 80% in namespace-b.
   {{ else if eq .CommonLabels.namespace "namespace-c" }}
   Alert: CPU limits have reached 80% in namespace-c.
   {{ else }}
   Alert: CPU limits have reached 80% for {{ .CommonLabels.namespace }} namespace.
   {{ end }}
   {{ end }}
   ```

This template alters the content of alert notifications depending on the namespace value.

** Make sure to replace the `.namespace` label with a label that exists in your alert rule. Replace `namespace-a`, `namespace-b`, and `namespace-c` with your specific namespace values. **

Used functions and syntax:

- `.CommonLabels` is a map containing the labels that are common to all the alerts firing.

## Templates for contact points

Though the way alerts are processed remains largely uniform across contact points, the templates are tailored to suit the unique characteristics of each platform. Each contact point has its own formatting standards, interaction methods, and message presentation styles. These templates are customized to ensure that alerts are displayed effectively and aligned with the communication model of each platform, delivering a cohesive user experience across different channels.

### Email

#### Template the subject of an email

Template the subject of an email to contain the number of firing and resolved alerts:

```
1 firing alert(s), 0 resolved alerts(s)
```

1. Create a template called `email.subject` with the following content:

   ```
   {{ define "email.subject" }}
   {{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
   {{ end }}
   ```

2. Execute the template from the subject field in your contact point integration:

   ```
   {{ template "email.subject" . }}
   ```

#### Template the message of an email

Template the message of an email to contain a summary of all firing and resolved alerts:

```
There are 2 firing alert(s), and 1 resolved alert(s)

Firing alerts:

- alertname=Test 1 grafana_folder=GrafanaCloud has value(s) B=1
- alertname=Test 2 grafana_folder=GrafanaCloud has value(s) B=2

Resolved alerts:

- alertname=Test 3 grafana_folder=GrafanaCloud has value(s) B=0
```

1. Create a notification template called `email` with two templates in the content: `email.message_alert` and `email.message`.

   The `email.message_alert` template is used to print the labels and values for each firing and resolved alert while the `email.message` template contains the structure of the email.

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

2. Execute the template from the message field in your contact point integration:

   ```
   {{ template "email.message" . }}
   ```

#### Group multiple alert instances into one email notification

To make alerts more concise, you can group multiple instances of a firing alert into a single email notification in a table format. This way, you avoid long, repetitive emails and make alerts easier to digest.

Follow these steps to create a custom notification template that consolidates alert instances into a table.

1. Modify the alert rule to include an annotation that is referenced in the notification template later on.
1. Enter a name for the **custom annotation**: In this example, _ServerInfo_.
1. Enter the following code as the value for the annotation. It retrieves the server's instance name and a corresponding metric value, formatted as a table row:

   ```
   {{ index $labels "instance" }}{{- "\t" -}}{{ index $values "A"}}{{- "\n" -}}
   ```

   This line of code returns the labels and their values in the form of a table. Assuming $labels has `{"instance": "node1"}` and $values has `{"A": "123"}`, the output would be:

   ```
   node1    123
   ```

1. Create a notification template that references the _ServerInfo_ annotation.

   ```go
   {{ define "Table" }}
   {{- "\nHost\t\tValue\n" -}}
   {{ range .Alerts -}}
   {{ range .Annotations.SortedPairs -}}
   {{ if (eq .Name  "ServerInfo") -}}
   {{ .Value -}}
   {{- end }}
   {{- end }}
   {{- end }}
   {{ end }}
   ```

   The notification template outputs a list of server information from the "ServerInfo" annotation for each alert instance.

1. Navigate to your contact point in Grafana
1. In the **Message** field, reference the template by name (see **Optional Email settings** section):

   ```
   {{ template "Table" . }}
   ```

   This generates a neatly formatted table in the email, grouping information for all affected servers into a single notification.

### Slack

#### Template the title of a Slack message

Template the title of a Slack message to contain the number of firing and resolved alerts:

```
1 firing alert(s), 0 resolved alerts(s)
```

1. Create a template called `slack.title` with the following content:

   ```
   {{ define "slack.title" }}
   {{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
   {{ end }}
   ```

2. Execute the template from the title field in your contact point integration:

   ```
   {{ template "slack.title" . }}
   ```

#### Template the content of a Slack message

Template the content of a Slack message to contain a description of all firing and resolved alerts, including their labels, annotations, Silence URL and Dashboard URL.

**Note:**

This template is for Grafana-managed alerts only.
To use the template for Grafana Mimir/Loki-managed alerts, delete the references to DashboardURL and SilenceURL.
For more information, see the [Prometheus documentation on notifications](https://prometheus.io/docs/alerting/latest/notifications/).

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

1. Create a template called `slack` with two templates in the content: `slack.print_alert` and `slack.message`.

   The `slack.print_alert` template is used to print the labels, annotations, SilenceURL and DashboardURL while the `slack.message` template contains the structure of the notification.

   ```
   {{ define "slack.print_alert" -}}
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

   {{ define "slack.message" -}}
   {{ if .Alerts.Firing -}}
   {{ len .Alerts.Firing }} firing alert(s):
   {{ range .Alerts.Firing }}
   {{ template "slack.print_alert" . }}
   {{ end -}}
   {{ end }}
   {{ if .Alerts.Resolved -}}
   {{ len .Alerts.Resolved }} resolved alert(s):
   {{ range .Alerts.Resolved }}
   {{ template "slack.print_alert" .}}
   {{ end -}}
   {{ end }}
   {{- end }}
   ```

2. Execute the template from the text body field in your contact point integration:

   ```
   {{ template "slack.message" . }}
   ```

### Template both email and Slack with shared templates

Instead of creating separate notification templates for email and Slack, you can share the same template.

For example, if you want to send an email with this subject and Slack message with this title:

```
1 firing alert(s), 0 resolved alerts(s)
```

1. Create a template called `common.subject_title` with the following content:

   ```
   {{ define "common.subject_title" }}
   {{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
   {{ end }}
   ```

2. For email, execute the template from the subject field in your email contact point integration:

   ```
   {{ template "common.subject_title" . }}
   ```

3. For Slack, execute the template from the title field in your Slack contact point integration:

   ```
   {{ template "common.subject_title" . }}
   ```

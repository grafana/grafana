---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
  - create templates
  - edit templates
  - delete templates
title: Create message templates
weight: 300
---

# Create message templates

Create reusable templates for your contact points.

A message template can contain more than one template. The name of the template must be unique. You should not have two templates with the same name in the same message template or in different message templates. You should also avoid defining templates with the same name as default templates such as `__subject`, `__text_values_list`, `__text_alert_list`, `default.title` and `default.message`.

1. In the Contact points tab you can see a list of your message templates

2. Click New template

3. Choose a name for the message template

4. Write the content of the template in the content field

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/new-message-template-email-subject-9-3.png" caption="New message template email.subject" >}}

5. Click Save

You will see that Grafana has added `{{ define "email.subject" }}` and `{{ end }}` to the start and end of the content:

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/edit-message-template-email-subject-9-3.png" caption="Edit message template email.subject" >}}

You can also create a message template that contains related templates.

1. In the Contact points tab you can see a list of your message templates

2. Click New Template

3. Choose a name for the message template

4. Write each template in the content field, including `{{ define "name-of-template" }}` and `{{ end }}` at the start and end of each template

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/new-message-template-email-9-3.png" caption="New message template" >}}

5. Click Save

## Template the subject of an email

To send emails where the subject contains the number of firing and resolved alerts:

```
1 firing alert(s), 0 resolved alerts(s)
```

create a template called `email.subject` with the following content:

```
{{ define "email.subject" }}
{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
{{ end }}
```

You can then execute the template from the subject field in your contact point integration:

```
{{ template "email.subject" . }}
```

## Template the message of an email

To send emails where the message contains a summary of all firing and resolved alerts:

```
There are 2 firing alert(s), and 1 resolved alert(s)

Firing alerts:

- alertname=Test 1 grafana_folder=GrafanaCloud has value(s) B=1
- alertname=Test 2 grafana_folder=GrafanaCloud has value(s) B=2

Resolved alerts:

- alertname=Test 3 grafana_folder=GrafanaCloud has value(s) B=0
```

create a message template called `email` with two templates in the content: `email.message_alert` and `email.message`. The `email.message_alert` template is used to print the labels and values for each firing and resolved alert while the `email.message` template contains the structure of the email.

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

You can then execute the template from the message field in your contact point integration:

```
{{ template "email.message" . }}
```

## Template the title of a Slack message

You can template the subject of a Slack message just like you would template the subject of an email. To send Slack messages where the title contains the number of firing and resolved alerts:

```
1 firing alert(s), 0 resolved alerts(s)
```

create a template called `slack.title` with the following content:

```
{{ define "slack.title" }}
{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
{{ end }}
```

You can then execute the template from the title field in your contact point integration:

```
{{ template "slack.title" . }}
```

## Template the content of a Slack message

To send Slack messages where the content contains a description of all firing and resolved alerts, including their labels, annotations, Silence URL and Dashboard URL:

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

create a template called `slack` with two templates in the content: `slack.print_alert` and `slack.message`. The `slack.print_alert` template is used to print the labels, annotations, SilenceURL and DashboardURL while the `slack.message` template contains the structure of the notification.

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

You can then execute the template from the text body field in your contact point integration:

```
{{ template "slack.message" . }}
```

## Template both email and Slack with shared templates

Instead of creating separate message templates for email and Slack, you can instead share the same template. For example, to send an email and Slack message with the same subject and title:

```
1 firing alert(s), 0 resolved alerts(s)
```

create a template called `common.subject_title` with the following content:

```
{{ define "common.subject_title" }}
{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)
{{ end }}
```

You can then execute the template from the subject field in your email contact point integration:

```
{{ template "common.subject_title" . }}
```

and from the title field in your Slack contact point integration:

```
{{ template "common.subject_title" . }}
```

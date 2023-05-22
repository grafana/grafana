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
title: Create notification templates
weight: 200
---

# Create notification templates

Create reusable notification templates to send to your contact points.

You can add one or more templates to your notification template.

Your notification template name must be unique. You cannot have two templates with the same name in the same notification template or in different notification templates. Avoid defining templates with the same name as default templates, such as: `__subject`, `__text_values_list`, `__text_alert_list`, `default.title` and `default.message`.

In the Contact points tab, you can see a list of your notification templates.

To create a template, complete the following steps.

1. Click **Add template**.

2. Choose a name for the notification template.

3. Write the content of the template in the content field.

   {{< figure max-width="940px" src="/static/img/docs/alerting/unified/new-notification-template-email-subject-9-4.png" caption="New notification template email.subject" >}}

4. Click **Save**.

`{{ define "email.subject" }}` and `{{ end }}` is automatically added to the start and end of the content:

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/edit-notification-template-email-subject-9-4.png" caption="Edit notification template email.subject" >}}

To create a notification template that contains more than one template:

1. Click **Add Template**.

2. Enter a name for the notification template.

3. Write each template in the Content field, including `{{ define "name-of-template" }}` and `{{ end }}` at the start and end of each template.

   {{< figure max-width="940px" src="/static/img/docs/alerting/unified/new-notification-template-email-9-4.png" caption="New notification template" >}}

4. Click **Save**.

## Preview notification templates

Preview how your notification templates will look before using them in your contact points, helping you understand the result of the template you are creating as well as enabling you to fix any errors before saving it.

**Note:** This feature is only for Grafana Alertmanager.

To preview your notification templates:

1. Navigate to **Alerts&IRM** -> **Alerting** -> **Contact points**.
1. Click **+Add template** or edit an existing template.
1. Add or update your template content.

   Default data is provided and you can add or edit alert data to it as well as alert instances. You can add alert data directly in the Payload data window itself or click **Choose alert instances** or **Add alert data**.

1. [Optional] To add alert data from existing alert instances:

   a. Click **Choose alert instances**.

   b. Hover over the alert instances to view more information on each alert instance.

   c. Click **Confirm** to add the alert instance(s) to the payload.

1. [Optional] To add alert data using the Alert data editor, click **Add alert data:**

   a. Add annotations, custom labels and/or set a dashboard or a panel.

   b. Toggle Firing/resolved depending on whether you want to add firing or resolved alerts to your notification.

   c. Click **Add alert data to payload**.

   d. Click **Refresh preview** to see what your template content will look like and the corresponding payload data.

   If there are any errors in your template, they are displayed in the Preview and you can correct them before saving.

1. Click **Save.**

## Template the subject of an email

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

## Template the message of an email

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

## Template the title of a Slack message

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

## Template the content of a Slack message

Template the content of a Slack message to contain a description of all firing and resolved alerts, including their labels, annotations, Silence URL and Dashboard URL:

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

## Template both email and Slack with shared templates

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

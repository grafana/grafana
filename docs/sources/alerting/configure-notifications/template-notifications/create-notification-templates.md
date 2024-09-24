---
aliases:
  - ../../manage-notifications/template-notifications/create-notification-templates/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/create-notification-templates/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/create-notification-templates/
description: Create notification templates to sent to your contact points
keywords:
  - grafana
  - alerting
  - notifications
  - templates
  - create templates
  - edit templates
  - delete templates
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Create notification templates
weight: 200
---

# Create notification templates

Create reusable notification templates to send to your contact points.

You can add one or more templates to your notification template.

Your notification template name must be unique. You cannot have two templates with the same name in the same notification template or in different notification templates. Avoid defining templates with the same name as default templates, such as: `__subject`, `__text_values_list`, `__text_alert_list`, `default.title` and `default.message`.

To create a notification template, complete the following steps.

1. Click **Alerts & IRM** -> **Contact points**.
1. Click the **Notification Templates** tab and then **+ Add notification template**.

1. Enter a name for the notification template.

1. Write the content of the template in the content field.

1. Save your changes.

`{{ define "email.subject" }}` and `{{ end }}` is automatically added to the start and end of the content:

To create a notification template that contains more than one template:

1. Click **+ Add notification template**.

2. Enter a name for the notification template.

3. Write each template in the Content field, including `{{ define "name-of-template" }}` and `{{ end }}` at the start and end of each template.

4. Save your changes.

## Preview notification templates

Preview how your notification templates should look before using them in your contact points, helping you understand the result of the template you are creating as well as enabling you to fix any errors before saving it.

**Note:** This feature is only for Grafana Alertmanager.

To preview your notification templates:

1. Navigate to **Alerts&IRM** -> **Alerting** -> **Contact points** -> **Notification Templates**.
1. Click **+ Add notification template** or edit an existing template.
1. Add or update your template content.

   Default data is provided and you can add or edit alert data to it as well as alert instances. You can add alert data directly in the Payload data window itself or click **Select alert instances** or **Add custom alerts**.

1. Optional: To add alert data from existing alert instances:

   a. Click **Select alert instances**.

   b. Hover over the alert instances to view more information on each alert instance.

   c. Click **Confirm** to add the alert instance(s) to the payload.

1. Optional: To add alert data using the Alert data editor, click **Add custom data:**

   a. Add annotations, custom labels and/or set a dashboard or a panel.

   b. Toggle Firing/resolved depending on whether you want to add firing or resolved alerts to your notification.

   c. Click **Add alert data**.

   d. Click **Refresh preview** to see what your template content should look like and the corresponding payload data.

   If there are any errors in your template, they are displayed in the Preview and you can correct them before saving.

1. Save your changes.

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

## Group multiple alert instances into one email notification

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

## Conditional notification template

Template alert notifications based on a label. In this example the label represents a namespace.

1. Use the following code in your notification template to display different messages based on the namespace:

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

   `.CommonLabels` is a map containing the labels that are common to all the alerts firing.

   Make sure to replace the `.namespace` label with a label that exists in your alert rule.

1. Replace `namespace-a`, `namespace-b`, and `namespace-c` with your specific namespace values.
1. Navigate to your contact point in Grafana
1. In the **Message** field, reference the template by name (see **Optional settings** section):

   ```
   {{ template "my_conditional_notification" . }}
   ```

   This template alters the content of alert notifications depending on the namespace value.

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

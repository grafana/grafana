---
aliases:
  - ../manage-notifications/template-notifications/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/
description: Customize your notifications using notification templates
keywords:
  - grafana
  - alerting
  - notifications
  - templates
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Template notifications
weight: 450
refs:
  template-annotations-and-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/
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
  examples:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/examples/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/examples/
---

# Template notifications

You can use notification templates to change the title, message, and format of notifications.

Grafana provides a **default template** for notification titles (`default.title`) and one default template for notification messages (`default.message`). Both templates display common alert details.

You can also create a notification template to customize the content and format of your notification messages. For example:

- Personalize the subject of an email or the title of a message.
- Modify text within notifications, like selecting or omitting certain labels, annotations, and links.
- Format text with bold and italic styles, and add or remove line breaks.

However, there are limitations. You cannot:

- Modify Visual Appearance: Add HTML or CSS to email notifications for visual changes. Alter the design of notifications in messaging services like Slack or Microsoft Teams, such as adding custom blocks or adaptive cards.
- Manage Media and Data: Customize the data structure or format passed to the templates, like adding new JSON fields or sending XML data for webhooks. Modify HTTP headers in webhooks beyond those defined in the configuration, or adjust the number, size, or placement of images.

Here's an [example](ref:examples) that displays the summary and description annotations for each alert in the notification:

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

The notification message would look like this:

```
2 alert(s)

  Summary: The database server db1 has exceeded 75% of available disk space.
  Status: firing
  Description: This alert fires when a database server is at risk of running out of disk space. You should take measures to increase the maximum available disk space as soon as possible to avoid possible corruption.

  Summary: The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes.
  Status: resolved
  Description: This alert fires when a web server responds with more 5xx errors than is expected. This could be an issue with the web server or a backend service.
```

{{% admonition type="note" %}}
Avoid adding extra information about alert instances in notification templates, as this information will only be visible in the notification message.

Instead, you should [use annotations or labels](ref:template-annotations-and-labels) to add information directly to the alert, ensuring it's also visible in the alert state and alert history within Grafana. You can then print the new alert annotation or label in notification templates.
{{% /admonition %}}

#### Select a notification template for a contact point

Notification templates are not tied to specific contact point integrations, such as email or Slack, and the same template can be shared across multiple contact points.

The notification template is assigned to the contact point to determine the notification message sent to contact point integrations.

{{< figure src="/media/docs/alerting/how-notification-templates-works.png" max-width="1200px" caption="A flow of the alert notification process, from querying the alert rule to sending the alert notification message." >}}

By default, Grafana provides default templates, such as `{{define "default.title"}}` and `{{define "default.message"}}`, to format notification messages.

## More information

For further details on how to write notification templates, refer to:

- [Select, create, and preview a notification template](ref:manage-notification-templates)
- [Notification template reference](ref:reference)
- [Notification template examples](ref:examples)

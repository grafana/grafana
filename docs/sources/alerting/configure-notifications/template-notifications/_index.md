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
weight: 430
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

Grafana provides a default template for notification titles (`default.title`) and one default template for notification messages (`default.message`). Both templates display common alert details.

You can also create a notification template to customize the content and format of your notification messages. For example:

- Personalize the subject of an email or the title of a message.
- Modify text within notifications, like selecting or omitting certain labels, annotations, and links.
- Format text with bold and italic styles, and add or remove line breaks.

However, you cannot change HTML or CSS code to modify the visual appearance, or alter the structure of the data passed to notification templates.

{{% admonition type="note" %}}
Avoid adding extra information about alert instances in notification templates, as this information will only be visible in the notification message. Instead, you should [use annotations or labels](ref:template-annotations-and-labels) to add information directly to the alert, ensuring it's also visible in the alert state and alert history within Grafana.
{{% /admonition %}}

Here's an example of a custom notification template that summarizes all firing and resolved alerts in the notification group:

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

The notification message would look like this:

```
1 firing alert(s)
- The database server db1 has exceeded 75% of available disk space. Disk space used is 76%, please resize the disk size within the next 24 hours.

1 resolved alert(s)
- The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes.
```

#### Select a notification template for a contact point

Notification templates are not tied to specific contact point integrations, such as email or Slack, and the same template can be shared across multiple contact points.

The notification template is assigned to the contact point to determine the notification message sent to receivers.

{{< figure src="/media/docs/alerting/how-notification-templates-works.png" max-width="1200px" caption="A flow of the alert notification process, from querying the alert rule to sending the alert notification message." >}}

## More information

For further details on how to write notification templates, refer to:

- [Select, create, and preview a notification template](ref:manage-notification-templates)
- [Notification template reference](ref:reference)
- [Notification template examples](ref:examples)

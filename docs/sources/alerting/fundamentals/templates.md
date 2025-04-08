---
aliases:
  - ../fundamentals/notifications/templates/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/templates/
  - ../contact-points/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/message-templating/
  - ../alert-rules/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alert-rules/message-templating/
  - ../unified-alerting/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/message-templating/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/templates/
description: Use templating to customize, format, and reuse alert notification messages. Create more flexible and informative alert notification messages by incorporating dynamic content, such as metric values, labels, and other contextual information.
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Templates
meta_image: /media/docs/alerting/how-notification-templates-works.png
weight: 115
refs:
  labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#labels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#labels
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#annotations
  templating-labels-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/
  notification-message-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/
  template-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
---

# Templates

Use templating to customize, format, and reuse alert notification messages. Create more flexible and informative alert notification messages by incorporating dynamic content, such as metric values, labels, and other contextual information.

In Grafana, you have various options to template your alert notification messages:

1. [Alert rule annotations](#template-annotations)

   - Annotations add extra information, like `summary` and `description`, to alert instances for notification messages.
   - Template annotations to display query values that are meaningful to the alert, for example, the server name or the threshold query value.

1. [Alert rule labels](#template-labels)

   - Labels are used to differentiate an alert instance from all other alert instances.
   - Template labels to add an additional label based on a query value, or when the labels from the query are incomplete or not descriptive enough.
   - Avoid displaying query values in labels as this can create numerous alert instances—use annotations instead.

1. [Notification templates](#template-notifications)
   - Notification templates are used by contact points for consistent messaging in notification titles and descriptions.
   - Template notifications when you want to customize the appearance and information of your notifications.
   - Avoid using notification templates to add extra information to alert instances—use annotations instead.

{{< admonition type="tip" >}}
For a practical example of templating, refer to our [Getting Started with Templating tutorial](https://grafana.com/tutorials/alerting-get-started-pt4/).
{{< /admonition  >}}

This diagram illustrates the entire templating process, from querying labels and templating the alert summary and notification to the final alert notification message.

{{< figure src="/media/docs/alerting/how-notification-templates-works.png" max-width="1200px" caption="How templating works" >}}

In this diagram:

1. The alert rule query returns `12345`, along with the values of the `instance` and `job` labels.
1. This query result breaches the alert rule condition, firing the alert instance.
1. The alert instance generates an annotation summary, defined by the template used in the alert rule summary. In this case, it displays the value of the `instance` label: `server1`.
1. The Alertmanager receives the firing alert instance, including the final annotation summary, and determines the contact point that will process the alert.
1. The Alertmanager uses the contact point's notification template to format the message, then sends the notification to the configured destination(s)—an email address.

## Template annotations

[Annotations](ref:annotations) can be defined in the alert rule to add extra information to alert instances.

When creating an alert rule, Grafana suggests several optional annotations, such as `description`, `summary`, and `runbook_url`, which help identify and respond to alerts. You can also create custom annotations.

Annotations are key-value pairs, and their values can contain a combination of text and template code that is evaluated when the alert fires.

Annotations can contain plain text, but you should template annotations if you need to display query values that are relevant to the alert, for example:

- Show the query value that triggers the alert.
- Include labels returned by the query that identify the alert.
- Format the annotation message depending on a query value.

Here’s an example of templating an annotation, which explains where and why the alert was triggered. In this case, the alert triggers when CPU usage exceeds a threshold, and the `summary` annotation provides the relevant details.

```
CPU usage for {{ $labels.instance }} has exceeded 80% ({{ $values.A.Value }}) for the last 5 minutes.
```

The outcome of this template would be:

```
CPU usage for Instance 1 has exceeded 80% (81.2345) for the last 5 minutes.
```

Implement annotations that provide meaningful information to respond to your alerts. Annotations are displayed in the Grafana alert detail view and are included by default in notifications.

For more details on how to template annotations, refer to [Template annotations and labels](ref:templating-labels-annotations).

## Template labels

[Labels](ref:labels) are used to differentiate one alert instance from all other alert instances, as the set of labels uniquely identifies an alert instance. Notification policies and silences use labels to handle alert instances.

You can also template labels based on query results. This is helpful if the labels you get from your query aren't detailed enough. For instance:

- Add a new label to change how alerts are identified and grouped into different alert groups.
- Add a new label used by notification policies or silences to manage how the alert is handled.

Here’s an example of templating a new `env` label based on the value of a query label:

```go
{{- if eq $labels.instance "prod-server-1" -}}
production
{{- else if eq $labels.instance "staging-server-1" -}}
staging
{{- else -}}
development
{{- end -}}
```

For more details on how to template labels, refer to [Template annotations and labels](ref:templating-labels-annotations).

## Template notifications

[Notification templates](ref:template-notifications) allow you to customize the content of your notifications, such as the subject of an email or the body of a Slack message.

Notification templates differ from templating annotations and labels in the following ways:

- Notification templates are assigned to the **Contact point**, rather than the alert rule.
- If not specified, the contact point uses a default template that includes relevant alert information.
- The same template can be shared across multiple contact points, making it easier to maintain and ensuring consistency.
- Notification templates should not be used to add additional information to individual alerts—use annotations for that purpose.
- While both annotation/label templates and notification templates use the same templating language, the available variables and functions differ. For more details, refer to the [notification template reference](ref:notification-message-reference) and [annotation/label template reference](ref:templating-labels-annotations).

Here is an example of a notification template that summarizes all firing and resolved alerts in a notification group:

```go
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

The notification message to the contact point would look like this:

```
1 firing alert(s)
- The database server db1 has exceeded 75% of available disk space. Disk space used is 76%, please resize the disk size within the next 24 hours.

1 resolved alert(s)
- The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes.
```

For more details, refer to [Template notifications](ref:template-notifications).

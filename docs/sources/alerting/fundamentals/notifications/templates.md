---
aliases:
  - ../../contact-points/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/message-templating/
  - ../../alert-rules/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alert-rules/message-templating/
  - ../../unified-alerting/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/message-templating/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/templates/
description: Learn about templates
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
  notification-messages:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
  templating-labels-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templating-labels-annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templating-labels-annotations/
---

# Templates

Use templating to customize, format, and reuse alert notification messages. Create more flexible and informative alert notification messages by incorporating dynamic content, such as metric values, labels, and other contextual information.

In Grafana, you have various options to template your alert notification messages:

1. [Alert rule annotations](#template-annotations)

   - Annotations add extra information, like `summary` and `description`, to alert instances for notification messages.
   - Template annotations to display query values that are meaningful to the alert, for example, the server name or the threshold query value.

1. [Alert rule labels](#template-labels)

   - Labels are used to differentiate an alert instance from all other alert instances.
   - Template labels when the labels from the query are incomplete or not descriptive enough. It is generally unnecessary.

1. [Notification templates](#template-notifications)
   - Notification templates are used by contact points for consistent messaging in notification titles and descriptions.
   - Template notifications when you want to customize the appearance and information of your notifications.
   - Avoid using notification templates to add extra information to alert instances—use annotations instead.

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

When creating an alert rule, Grafana suggests several optional annotations, such as `description`, `summary`, `runbook_url`, `dashboardUId` and `panelId`, which help identify and respond to alerts. You can also create custom annotations.

Annotations are key-value pairs, and their values can contain a combination of text and template code that is evaluated when the alert fires.

Annotations can contain plain text, but you should template annotations if you need to display query values that are relevant to the alert, for example:

- Show the query value that triggers the alert.
- Include labels returned by the query that identify the alert.
- Format a message depending on a query value.

Here's an example of templating the `summary` annotation in an alert rule:

```
CPU usage for {{ index $labels "instance" }} has exceeded 80% ({{ index $values "A" }}) for the last 5 minutes.
```

The outcome of this template would be:

```
CPU usage for Instance 1 has exceeded 80% (81.2345) for the last 5 minutes.
```

Annotations should add meaningful information to an alert. They are displayed when viewing alerts in Grafana and can be included in notifications.

For details on how to template annotations, refer to [Template annotations and labels](ref:templating-labels-annotations).

## Template labels

Label templates are applied in the alert rule itself (i.e. in the Configure labels and notifications section of an alert).

{{<admonition type="note">}}
Think about templating labels when you need to improve or change how alerts are uniquely identified. This is especially helpful if the labels you get from your query aren't detailed enough. Keep in mind that it's better to keep long sentences for summaries and descriptions. Also, avoid using the query's value in labels because it may result in the creation of many alerts when you actually only need one.
{{</admonition>}}

Templating can be applied by using variables and functions. These variables can represent dynamic values retrieved from your data queries.

{{<admonition type="note">}}
In Grafana templating, the $ and . symbols are used to reference variables and their properties. You can reference variables directly in your alert rule definitions using the $ symbol followed by the variable name. Similarly, you can access properties of variables using the dot (.) notation within alert rule definitions.
{{</admonition>}}

Here are some commonly used built-in [variables](ref:templating-labels-annotations) to interact with the name and value of labels in Grafana alerting:

- The `$labels` variable, which contains all labels from the query.

  For example, let's say you have an alert rule that triggers when the CPU usage exceeds a certain threshold. You want to create annotations that provide additional context when this alert is triggered, such as including the specific server that experienced the high CPU usage.

        The host {{ index $labels "instance" }} has exceeded 80% CPU usage for the last 5 minutes

  The outcome of this template would print:

        The host instance 1 has exceeded 80% CPU usage for the last 5 minutes

- The `$value` variable, which is a string containing the labels and values of all instant queries; threshold, reduce and math expressions, and classic conditions in the alert rule.

  In the context of the previous example, $value variable would write something like this:

        CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes: {{ $value }}

  The outcome of this template would print:

        CPU usage for instance1 has exceeded 80% for the last 5 minutes: [ var='A' labels={instance=instance1} value=81.234 ]

- The `$values` variable is a table containing the labels and floating point values of all instant queries and expressions, indexed by their Ref IDs (i.e. the id that identifies the query or expression. By default the Red ID of the query is “A”).

  Given an alert with the labels instance=server1 and an instant query with the value 81.2345, would write like this:

        CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes: {{ index $values "A" }}

  And it would print:

        CPU usage for instance1 has exceeded 80% for the last 5 minutes: 81.2345

{{% admonition type="caution" %}}
Extra whitespace in label templates can break matches with notification policies.
{{% /admonition %}}

## Template notifications

Notification templates represent the alternative approach to templating designed for reusing templates. Notifications are messages to inform users about events or conditions triggered by alerts. You can create reusable notification templates to customize the content and format of alert notifications. Variables, labels, or other context-specific details can be added to the templates to dynamically insert information like metric values.

Here is an example of a notification template:

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

This is the message you would receive in your contact point:

            1 firing alert(s)
            - The database server db1 has exceeded 75% of available disk space. Disk space used is 76%, please resize the disk size within the next 24 hours

            1 resolved alert(s)
            - The web server web1 has been responding to 5% of HTTP requests with 5xx errors for the last 5 minutes

Once the template is created, you need to make reference to it in your **Contact point** (in the Optional `[contact point]` settings) .

{{<admonition type="note">}}
It's not recommended to include individual alert information within notification templates. Instead, it's more effective to incorporate such details within the rule using labels and annotations.
{{</admonition>}}

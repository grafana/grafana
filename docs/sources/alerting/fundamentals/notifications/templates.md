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
  variables-label-annotation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templating-labels-annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templating-labels-annotations/
---

# Templates

Use templating to customize, format, and reuse alert notification messages. Create more flexible and informative alert notification messages by incorporating dynamic content, such as metric values, labels, and other contextual information.

In Grafana, there are two ways to template your alert notification messages:

1. Labels and annotations

   - Template labels and annotations in alert rules.
   - Labels and annotations contain information about an alert.
   - Labels are used to differentiate an alert from all other alerts, while annotations are used to add additional information to an existing alert.

2. Notification templates

   - Template notifications in contact points.
   - Add notification templates to contact points for reuse and consistent messaging in your notifications.
   - Use notification templates to change the title, message, and format of the message in your notifications.

This diagram illustrates the entire process of templating, from the creation of labels and annotations in alert rules or notification templates in contact points, to what they look like when exported and applied in your alert notification messages.

{{< figure src="/media/docs/alerting/grafana-templating-diagram-2.jpg" max-width="1200px" caption="How Templating works" >}}

In this diagram:

- **Monitored Application**: A web server, database, or any other service generating metrics. For example, it could be an NGINX server providing metrics about request rates, response times, and so on.
- **Prometheus**: Prometheus collects metrics from the monitored application. For example, it might scrape metrics from the NGINX server, including labels like instance (the server hostname) and job (the service name).
- **Grafana**: Grafana queries Prometheus to retrieve metrics data. For example, you might create an alert rule to monitor NGINX request rates over time, and template labels or annotations based on the instance label.
- **Alertmanager**: Part of the Prometheus ecosystem, Alertmanager handles alert notifications. For example, if the request rate exceeds a certain threshold on a particular NGINX server, Alertmanager can send an alert notification to, for example, Slack or email, including the server name and the exceeded threshold (the instance label will be interpolated, and the actual server name will appear in the alert notification).
- **Alert notification**: When an alert rule condition is met, Alertmanager sends a notification to various channels such as Slack, Grafana OnCall, etc. These notifications can include information from the labels associated with the alerting rule. For example, if an alert triggers due to high CPU usage on a specific server, the notification message can include details like server name (instance label), disk usage percentage, and the threshold that was exceeded.

## Labels and annotations

Labels and annotations contain information about an alert. Labels are used to differentiate an alert from all other alerts, while annotations are used to add additional information to an existing alert.

### Template labels

Label templates are applied in the alert rule itself (i.e. in the Configure labels and notifications section of an alert).

{{<admonition type="note">}}
Think about templating labels when you need to improve or change how alerts are uniquely identified. This is especially helpful if the labels you get from your query aren't detailed enough. Keep in mind that it's better to keep long sentences for summaries and descriptions. Also, avoid using the query's value in labels because it may result in the creation of many alerts when you actually only need one.
{{</admonition>}}

Templating can be applied by using variables and functions. These variables can represent dynamic values retrieved from your data queries.

{{<admonition type="note">}}
In Grafana templating, the $ and . symbols are used to reference variables and their properties. You can reference variables directly in your alert rule definitions using the $ symbol followed by the variable name. Similarly, you can access properties of variables using the dot (.) notation within alert rule definitions.
{{</admonition>}}

Here are some commonly used built-in [variables](ref:variables-label-annotation) to interact with the name and value of labels in Grafana alerting:

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

### Template annotations

Both labels and annotations have the same structure: a set of named values; however their intended uses are different. The purpose of annotations is to add additional information to existing alerts.

There are a number of suggested annotations in Grafana such as `description`, `summary`, `runbook_url`, `dashboardUId` and `panelId`. Like labels, annotations must have a name, and their value can contain a combination of text and template code that is evaluated when an alert is fired.

Here is an example of templating an annotation in the context of an alert rule. The text/template is added into the Add annotations section.

        CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes

The outcome of this template would print

        CPU usage for Instance 1 has exceeded 80% for the last 5 minutes

### Template notifications

Notification templates represent the alternative approach to templating designed for reusing templates. Notifications are messages to inform users about events or conditions triggered by alerts. You can create reusable notification templates to customize the content and format of alert notifications. Variables, labels, or other context-specific details can be added to the templates to dynamically insert information like metric values.

Here is an example of a notification template:

```go
{ define "alerts.message" -}}
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

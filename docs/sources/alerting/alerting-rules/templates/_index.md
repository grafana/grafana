---
aliases:
  - ../fundamentals/annotation-label/variables-label-annotation/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/annotation-label/variables-label-annotation/
  - ../alerting-rules/templating-labels-annotations/ # /docs/grafana/<GRAFANA_VERSION>/alerting-rules/templating-labels-annotations/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/
description: Learn how to template annotations and labels to include data from queries and expressions in alert messages
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
title: Template annotations and labels
weight: 500
refs:
  reference-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#labels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#labels
  reference-values:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/#values
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/#values
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#annotations
  explore:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  intro-to-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/templates/
  alert-rule-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/reference/
  alert-rule-template-examples:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/examples/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/examples/
  notification-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/
  notification-data-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/#notification-data
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/#notification-data
  view-alert-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-alert-state/
  preview-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/manage-notification-templates/#preview-notification-templates
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/manage-notification-templates/#preview-notification-templates
  labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/latest/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
---

# Template annotations and labels

You can use templates to customize alert and notification messages, including dynamic data from alert rule queries.

In Grafana Alerting, you can template alert messages in two ways.

1. **Template annotations and labels**: In the alert rule definition, you can template annotations and labels to include extra information from query data to the alert, adding meaningful details based on the query results.
1. **Template notifications**: You can template notifications to control the content and appearance of your notifications.

## How templating works

In this diagram, you can see the differences between both types of templates.

{{< figure src="/media/docs/alerting/how-notification-templates-works.png" max-width="1200px" alt="How templating works" >}}

Refer to [Templates Introduction](ref:intro-to-templates) for a more detailed explanation of this diagram.

Both types of templates are written in the Go templating system. However, it's important to understand that variables and functions used in notification templates are different from those used in annotation and label templates.

1.  **Template annotations and labels**: These templates add extra information to individual alert instances. Template variables like [`$labels`](ref:reference-labels) and [`$values`](ref:reference-values) represent alert query data of the individual alert instance.
1.  **Template notifications**: Notification templates format the notification content for a group of alerts. Variables like [`.Alerts`](ref:notification-data-reference) include all firing and resolved alerts in the notification.

## Template annotations

[Annotations](ref:annotations) add additional information to alert instances and are often used to help identify the alert and guide responders on how to address the issue.

Annotations are key-value pairs defined in the alert rule. They can contain plain text or template code that is evaluated when the alert fires.

Grafana includes several optional annotations, such as `description`, `summary`, `runbook_url`, `dashboardUId` and `panelId`, which can be edited in the alert rule. You can also create your custom annotations. For example, you might create a new annotation named `location` to report the location of the system that triggered the alert.

Here’s an example of a `summary` annotation explaining why the alert was triggered, using plain text.

```
CPU usage has exceeded 80% for the last 5 minutes.
```

However, if you want to display dynamic query values in annotations, you need to use template code. Common use cases include:

- Displaying the query value that triggered the alert.
- Highlighting label information that identifies the alert, such as the environment, instance, or region.
- Providing specific instructions based on query values.
- Customizing runbook links depending on query labels.
- Including contact information based on query labels.

For instance, you can template the previous example to display the specific instance and CPU value that triggered the alert.

```
CPU usage for {{ $labels.instance }} has exceeded 80% ({{ $values.A.Value }}) for the last 5 minutes.
```

Alternatively, you can use the `index` function to print query values.

```
CPU usage for {{ index $labels "instance" }} has exceeded 80% ({{ index $values "A" }}) for the last 5 minutes.
```

The result of the annotation would be as follows.

```
CPU usage for Instance 1 has exceeded 80% (81.2345) for the last 5 minutes.
```

### How to template an annotation

Complete the following steps to template an annotation.

1. Navigate to **Alerts & IRM** -> **Alert rules** -> create or edit an alert rule.
1. Scroll down to the **Configure notification message** section.
1. Copy in your template in the corresponding annotation field (`summary`, `description`, `runbook_url`, `custom`).

### Preview annotation templates

You can template annotations when creating or editing an alert rule.

{{< figure src="/media/docs/alerting/alert-rule-using-annotation-template.png" max-width="1200px" alt="An alert rule templating the annotation summary" >}}

Two common methods are used to test and preview annotation templates:

1. Trigger the alert and [view the alert instance state in the Grafana UI](ref:view-alert-state), where all annotations of the alert instance are displayed.
1. Use a notification template that displays all annotations, then [preview the notification template](ref:preview-notifications) using the alert instance.

## Template labels

The set of [labels](ref:labels) for an alert instance is used to uniquely identify that alert among all other alert instances.

Labels determine how alerts are routed and managed for notifications, making their design key to the effectiveness of your alerting system.

Labels can be returned from an alert rule query, such as the `pod` label in a Kubernetes Prometheus query. You can also define additional labels in the alert rule to provide extra information for processing alerts.

Like annotations, labels are key-value pairs that can contain plain text or template code evaluated when the alert fires.

Template labels when the labels returned by your queries are insufficient. For instance:

- A new label based on a query value can group a subset of alerts differently, changing how notifications are sent.
- A new label based on a query value can be used in a notification policy to alter the notification contact point.

Here’s an example of templating a `severity` label based on the query value.

```
{{ if (gt $values.A.Value 90.0) -}}
critical
{{ else if (gt $values.A.Value 80.0) -}}
high
{{ else if (gt $values.A.Value 60.0) -}}
medium
{{ else -}}
low
{{- end }}
```

In this example, the value of the `severity` label is determined by the query value, and the possible options are `critical`, `high`, `medium`, or `low`. You can then use the `severity` label to change their notifications—for instance, sending `critical` alerts immediately or routing `low` alerts to a specific team for further review.

{{% admonition type="note" %}}
You should avoid displaying query values in labels, as this may create numerous unique alert instances—one for each distinct label value. Instead, use annotations for query values.
{{% /admonition %}}

### How to template a label

Complete the following steps to template a label.

1. Navigate to **Alerts & IRM** -> **Alert rules** -> create or edit an alert rule.
1. Scroll down to the **Configure labels and notifications** section.
1. Click **+ Add labels**.
1. Enter a **key** that identifies the label.
1. Copy in your template in the **value** field.

### Preview label templates

You can template label values when creating or editing an alert rule.

To preview label values, select `Use notification policy`, and then click on `Preview routing`.

{{< figure src="/media/docs/alerting/alert-instance-routing-preview.png" max-width="1200px" alt="Routing preview displays label values" >}}

## More information

For further details on how to template alert rules, refer to:

- [Annotation and label template reference](ref:alert-rule-template-reference)
- [Annotation and label examples](ref:alert-rule-template-examples)

{{< admonition type="tip" >}}
For a practical example of templating, refer to our [Getting Started with Templating tutorial](https://grafana.com/tutorials/alerting-get-started-pt4/).
{{< /admonition  >}}

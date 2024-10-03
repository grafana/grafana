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
  view-alert-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-state-health/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/manage-notifications/view-state-health/
  preview-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/manage-notification-templates/#preview-notification-templates
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/manage-notification-templates/#preview-notification-templates
---

# Template annotations and labels

You can use templates to customize alert and notification messages, including dynamic data from alert rule queries.

Grafana Alerting offers two ways for templating alert messages:

1. **Template annotations and labels**: In the alert rule definition, you can template annotations and labels to add extra information from query data, enriching individual alerts with meaningful details from query results.
1. **Template notifications**: You can template notifications to control the content and appearance of their notifications.

Both types of templates are written in the Go templating system. However, it's important to understand that [variables and functions used in notification templates](ref:notification-template-reference) are different from those used in [annotation and label templates](ref:alert-rule-template-reference).

## How templating works

See the differences between both types of templates in this diagram:

{{< figure src="/media/docs/alerting/how-notification-templates-works.png" max-width="1200px" alt="How templating works" >}}

1.  **Template annotations and labels**: These templates add extra information to individual alert instances. Template variables like `$labels` and `$values` represent alert query data of the individual alert instance.
1.  **Template notifications**: Notification templates format the notification content for a group of alerts, including variables for all firing (`.Alerts.Firing`) and resolved alerts (`.Alerts.Resolved`) in the notification.

For a more detailed explanation of this diagram, refer to the [Templates Introduction](ref:intro-to-templates).

## Template annotations

Annotations add additional information to alert instances and are often used to help identify the alert and guide responders on how to address the issue.

Annotations are key-value pairs defined in the alert rule. They can contain plain text or template code that is evaluated when the alert fires.

Grafana includes several optional annotations, such as `description`, `summary`, `runbook_url`, `dashboardUId` and `panelId`, which can be edited in the alert rule. You can also create your custom annotations. For example, you might create a new annotation named `location` to report the location of the system that triggered the alert.

Here’s an example of a `summary` annotation explaining why the alert was triggered, using plain text:

```
CPU usage has exceeded 80% for the last 5 minutes.
```

However, if you want to display dynamic query values in annotations, you need to use template code. Common use cases include:

- Displaying the query value or threshold that triggered the alert.
- Highlighting label information that identifies the alert, such as environment, region, or priority.
- Providing specific instructions based on query values.
- Customizing runbook links depending on query or label values.
- Including contact information based on alert labels.

For instance, you can template the previous example to display the specific instance and CPU value that triggered the alert:

```
CPU usage for {{ index $labels "instance" }} has exceeded 80% ({{ index $values "A" }}) for the last 5 minutes.
```

The result of this annotation would now be:

```
CPU usage for Instance 1 has exceeded 80% (81.2345) for the last 5 minutes.
```

For more information on how to template annotations, refer to the [Template reference](ref:alert-rule-template-reference) and [examples](ref:alert-rule-template-examples).

#### Preview annotation templates

You can template annotations when creating or editing an alert rule.

{{< figure src="/media/docs/alerting/alert-rule-using-annotation-template.png" max-width="1200px" alt="An alert rule templating the annotation summary" >}}

Two common methods to test or preview annotation templates are:

1. Trigger the alert and [view the alert instance state in the Grafana UI](ref:view-alert-state), where all annotations of the alert instance are displayed.
1. Create a notification template that displays the alert annotation, then [preview the notification template](ref:preview-notifications) using the alert instance.

## Template labels

For example, you might want to set the severity label for an alert based on the value of the query

When using custom labels with templates it is important to make sure that the label value does not change between consecutive evaluations of the alert rule as this will end up creating large numbers of distinct alerts. However, it is OK for the template to produce different label values for different alerts. For example, do not put the value of the query in a custom label as this will end up creating a new set of alerts each time the value changes. Instead use annotations.

{{% admonition type="caution" %}}
Extra whitespace in label templates can break matches with notification policies.
{{% /admonition %}}

**Preview label templates**

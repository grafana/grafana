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
  notification-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/
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

, or use the instance label from the query in a summary annotation so you know which server is experiencing high CPU usage.

### Preview annotations

## Template labels

For example, you might want to set the severity label for an alert based on the value of the query

When using custom labels with templates it is important to make sure that the label value does not change between consecutive evaluations of the alert rule as this will end up creating large numbers of distinct alerts. However, it is OK for the template to produce different label values for different alerts. For example, do not put the value of the query in a custom label as this will end up creating a new set of alerts each time the value changes. Instead use annotations.

{{% admonition type="caution" %}}
Extra whitespace in label templates can break matches with notification policies.
{{% /admonition %}}

### Preview labels

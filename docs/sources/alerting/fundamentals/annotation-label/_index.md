---
aliases:
  - ../alerting-rules/alert-annotation-label/
  - ../unified-alerting/alerting-rules/alert-annotation-label/
description: Annotations and labels for alerting
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - create
title: Annotations and labels for alerting rules
weight: 401
---

# Annotations and labels for alerting rules

Annotations and labels are key value pairs associated with alerts originating from the alerting rule, datasource response, and as a result of alerting rule evaluation. They can be used in alert notifications directly or in [templates]({{< relref "../../contact-points/message-templating/" >}}) and [template functions]({{< relref "./template-functions" >}}) to create notification content dynamically.

## Annotations

Annotations are key-value pairs that provide additional meta-information about an alert. You can use the following annotations: `description`, `summary`, `runbook_url`, `alertId`, `dashboardUid`, and `panelId`. For example, a description, a summary, and a runbook URL. These are displayed in rule and alert details in the UI and can be used in contact point message templates.

## Labels

Labels are key-value pairs that contain information about, and are used to uniquely identify an alert. The label set for an alert is generated and added to throughout the alerting evaluation and notification process.

Before you begin using annotations and labels, familiarize yourself with:

- [Labels in Grafana Alerting]({{< relref "how-to-use-labels/" >}})
- [How label matching works]({{< relref "how-to-use-labels/" >}})
- [How to template annotations and labels]({{< relref "variables-label-annotation/" >}})

---
aliases:
  - ../fundamentals/data-source-alerting/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/data-source-alerting/
  - ../fundamentals/alert-rules/alert-instances/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/alert-instances/
  - ../fundamentals/alert-rules/organising-alerts/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/organising-alerts/
  - ../fundamentals/alert-rules/alert-rule-types/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/alert-rule-types/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/
description: Learn about alert rules
keywords:
  - grafana
  - alerting
  - rules
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alert rules
weight: 100
refs:
  queries-and-conditions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#data-source-queries
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#data-source-queries
  alert-condition:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#alert-condition
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#alert-condition
  alert-rule-evaluation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/rule-evaluation/
  notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/
  create-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/
  configure-grafana-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
  comparison-ds-grafana-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-data-source-managed-rule/#comparison-with-grafana-managed-rules
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-data-source-managed-rule/#comparison-with-grafana-managed-rules
---

# Alert rules

An alert rule is a set of evaluation criteria for when an alert rule should fire. An alert rule consists of:

1. [Queries](ref:queries-and-conditions) that select the dataset to evaluate.
1. An [alert condition](ref:alert-condition) (the threshold) that the query must meet or exceed to trigger the alert instance.

   {{< figure src="/media/docs/alerting/alerting-query-conditions-default-options.png" max-width="750px" alt="Alert query using the Prometheus query editor and alert condition" >}}

1. An interval that specifies the frequency of [alert rule evaluation](ref:alert-rule-evaluation) and a duration indicating how long the condition must be met to trigger the alert instance.
1. Other customizable options, including expressions, labels, annotations, error and no data handling, notification routing, and more.

## Alert rule types

Grafana Alerting inherits the Prometheus Alerting model for defining alert rules and supports two alert rule types:

- **Data source-managed alert rules**

  These alert rules can only query Prometheus-based data sources such as Mimir, Loki, and Prometheus. The rules are stored in the data source.

  Grafana Alerting supports this alert rule type for horizontal scalability with these data sources.

- **Grafana-managed alert rules**

  The recommended alert rule type in Grafana Alerting.

  These alert rules can query a wider range of backend data sources, including multiple data sources in a single alert rule. They support expression-based transformations, advanced alert conditions, images in notifications, handling of error and no data states, and [more](ref:comparison-ds-grafana-rules).

  You can find the supported public data sources in the [Grafana Plugins directory](/grafana/plugins/data-source-plugins/?features=alerting). For step-by-step instructions, see [Configure Grafana-managed alert rules](ref:configure-grafana-alerts).

## Recording rules

Similar to alert rules, recording rules are evaluated periodically. A recording rule pre-computes frequently used or computationally expensive queries, and saves the results as a new time series metric.

The new recording metric can then be used in alert rules and dashboards to optimize their queries. For further details, refer to [Create recording rules](ref:create-recording-rules).

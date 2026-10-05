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
---

# Alert rules

An alert rule is a set of evaluation criteria for when an alert rule should fire. An alert rule consists of:

1. [Queries](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#data-source-queries) that select the dataset to evaluate.
1. An [alert condition](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#alert-condition) (the threshold) that the query must meet or exceed to trigger the alert instance.

   {{< figure src="/media/docs/alerting/alerting-query-conditions-default-options.png" max-width="750px" alt="Alert query using the Prometheus query editor and alert condition" >}}

1. An interval that specifies the frequency of [alert rule evaluation](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/rule-evaluation/) and a duration indicating how long the condition must be met to trigger the alert instance.
1. Other customizable options, including expressions, labels, annotations, error and no data handling, notification routing, and more.

## About Grafana-managed alert rules

Grafana-managed alert rules can query a wide range of backend data sources, including multiple data sources in a single alert rule. They support expression-based transformations, advanced alert conditions, images in notifications, handling of error and no data states, and [more](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-data-source-managed-rule/#comparison-with-grafana-managed-rules).

You can find the supported public data sources in the [Grafana Plugins directory](/grafana/plugins/data-source-plugins/?features=alerting). For step-by-step instructions, see [Configure Grafana-managed alert rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Recording rules

Similar to alert rules, recording rules are evaluated periodically. A recording rule pre-computes frequently used or computationally expensive queries, and saves the results as a new time series metric.

The new recording metric can then be used in alert rules and dashboards to optimize their queries. For further details, refer to [Create recording rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/).

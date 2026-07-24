---
aliases:
  - ../fundamentals/alert-rules/recording-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/recording-rules/
  - ../unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/
  - ../unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
  - ../alerting-rules/create-mimir-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/
description: Recording rules allow you to pre-compute frequently needed or computationally expensive expressions and save the results as a new set of time series. Querying precomputed results is faster and can reduce system load.
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - recording rules
  - configure
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Create recording rules
weight: 400
refs:
  evaluation-within-a-group:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/evaluation-within-a-group/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/evaluation-within-a-group/
  grafana-managed-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
  data-source-managed-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-data-source-managed-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/create-data-source-managed-recording-rules/
---

# Configure recording rules

Recording rules allow you to periodically pre-compute frequently used or computationally expensive queries, saving the results as a new time series metric.

For instance, you can create a recording rule generating a new metric, `error_9001_count`, which counts occurrences of a specific log error within one minute. Then, query the `error_9001_count` metric in dashboards and alert rules.

Recording rules can be helpful in various scenarios, such as:

- **Faster queries** are needed: Performing heavy aggregations or querying large data sets is quicker with precomputed results than real-time queries.
- **Reducing system load:** Precomputing specific queries in advance can reduce system overload caused by multiple simultaneous queries.
- **Simplifying complex aggregations:** Create a new metric from complex aggregations to facilitate alert and dashboard setup.
- **Reusing queries to reduce costs:** Improve efficiency by reusing the same query across similar alert rules and dashboards.

## How recorded metrics work

A recording rule generates a new recorded metric by evaluating its rule definition on a fixed [evaluation interval](ref:evaluation-within-a-group) (for example, every `1m` or `5m`) and writing a single value as a new data point in the recorded metric.

The rule definition must return that single value, either from an instant query or a range query combined with a **Reduce** expression.

{{< figure src="/media/docs/alerting/recording-rules-diagram-v3.svg" alt="How recording rules generate recorded metrics" >}}

Recorded metrics are not guaranteed to exactly match the original raw data.

Aggregations in the recording rule query and evaluation lags can produce results that differ from the original raw data. Shorter evaluation intervals can reduce this gap by improving resolution.

For PromQL recommendations in recording rules, refer to [Prometheus recording rules best practices](https://prometheus.io/docs/practices/rules/).

## Alerting on recorded metrics

When alert rules query recorded metrics, consider the following recommendations:

- **Use frequent evaluation intervals**. Set frequent evaluation intervals for recording rules. Long intervals, such as an hour, can cause the recorded metric to be stale and lead to misaligned alert rule evaluations, especially when combined with a long pending period.
- **Align alert evaluation with recording frequency**. The evaluation interval of an alert rule that depends on a recorded metric should be aligned with the recording rule's interval. If a recording rule runs every 3 minutes, the alert rule should also be evaluated at a similar frequency to ensure it acts on fresh data. For details about the evaluation sequence, refer to [how rules are evaluated within a group](ref:evaluation-within-a-group).
- **Use `_over_time` functions for instant queries**. Since all alert rules are ultimately executed as an instant query, you can use functions like `max_over_time(my_metric[5m])` as an instant query. This allows you to get an aggregated value over a period without using a range query and a reduce expression.

## Types of recording rules

Similar to alert rules, Grafana supports two types of recording rules:

1. [Grafana-managed recording rules](ref:grafana-managed-recording-rules), which can query any Grafana data source supported by alerting. It's the recommended option.
2. [Data source-managed recording rules](ref:data-source-managed-recording-rules), which can query Prometheus-based data sources like Mimir or Loki.

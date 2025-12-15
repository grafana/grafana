---
aliases:
  - ../../data-sources/elasticsearch/alerting/
description: Using Grafana Alerting with the Elasticsearch data source
keywords:
  - grafana
  - elasticsearch
  - alerting
  - alerts
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Elasticsearch alerting
weight: 550
refs:
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  create-alert-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
---

# Elasticsearch alerting

You can use Grafana Alerting with Elasticsearch to create alerts based on your Elasticsearch data. This allows you to monitor metrics, detect anomalies, and receive notifications when specific conditions are met.

For general information about Grafana Alerting, refer to [Grafana Alerting](ref:alerting).

## Before you begin

Before creating alerts with Elasticsearch, ensure you have:

- An Elasticsearch data source configured in Grafana
- Appropriate permissions to create alert rules
- Understanding of the metrics you want to monitor

## Supported query types

Elasticsearch alerting works best with **metrics queries** that return time series data. To create a valid alert query:

- Use a **Date histogram** as the last bucket aggregation (under **Group by**)
- Select appropriate metric aggregations (Count, Average, Sum, Min, Max, etc.)

Queries that return time series data allow Grafana to evaluate values over time and trigger alerts when thresholds are crossed.

### Query types and alerting compatibility

| Query type                     | Alerting support | Notes                                                       |
| ------------------------------ | ---------------- | ----------------------------------------------------------- |
| Metrics with Date histogram    | ✅ Full support  | Recommended for alerting                                    |
| Metrics without Date histogram | ⚠️ Limited       | May not evaluate correctly over time                        |
| Logs                           | ❌ Not supported | Use metrics queries instead                                 |
| Raw data                       | ❌ Not supported | Use metrics queries instead                                 |
| Raw document (deprecated)      | ❌ Not supported | Deprecated since Grafana v10.1. Use metrics queries instead |

## Create an alert rule

To create an alert rule using Elasticsearch:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for the alert rule.
1. Select your **Elasticsearch** data source.
1. Build your query using the query editor:
   - Add metric aggregations (for example, Average, Count, Sum)
   - Add a Date histogram under **Group by**
   - Optionally add filters using Lucene query syntax
1. Configure the alert condition (for example, when the average is above a threshold).
1. Set the evaluation interval and pending period.
1. Configure notifications and labels.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](ref:create-alert-rule).

## Example alert queries

The following examples show common alerting scenarios with Elasticsearch.

### Alert on high error count

Monitor the number of error-level log entries:

1. **Query:** `level:error`
1. **Metric:** Count
1. **Group by:** Date histogram (interval: 1m)
1. **Condition:** When count is above 100

### Alert on average response time

Monitor API response times:

1. **Query:** `type:api_request`
1. **Metric:** Average on field `response_time`
1. **Group by:** Date histogram (interval: 5m)
1. **Condition:** When average is above 500 (milliseconds)

### Alert on unique user count drop

Detect drops in active users:

1. **Query:** `*` (all documents)
1. **Metric:** Unique count on field `user_id`
1. **Group by:** Date histogram (interval: 1h)
1. **Condition:** When unique count is below 100

## Limitations

When using Elasticsearch with Grafana Alerting, be aware of the following limitations:

### Template variables not supported

Alert queries cannot contain template variables. Grafana evaluates alert rules on the backend without dashboard context, so variables like `$hostname` or `$environment` won't be resolved.

If your dashboard query uses template variables, create a separate query for alerting with hard coded values.

### Logs queries not supported

Queries using the **Logs** metric type cannot be used for alerting. Convert your query to use metric aggregations with a Date histogram instead.

### Query complexity

Complex queries with many nested aggregations may timeout or fail to evaluate. Simplify queries for alerting by:

- Reducing the number of bucket aggregations
- Using appropriate time intervals
- Adding filters to limit the data scanned

## Best practices

Follow these best practices when creating Elasticsearch alerts:

- **Use specific filters:** Add Lucene query filters to focus on relevant data and improve query performance.
- **Choose appropriate intervals:** Match the Date histogram interval to your evaluation frequency.
- **Test queries first:** Verify your query returns expected results in Explore before creating an alert.
- **Set realistic thresholds:** Base alert thresholds on historical data patterns.
- **Use meaningful names:** Give alert rules descriptive names that indicate what they monitor.

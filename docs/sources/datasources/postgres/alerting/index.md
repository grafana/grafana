---
description: Set up alerts using PostgreSQL data in Grafana
keywords:
  - grafana
  - postgresql
  - alerting
  - alerts
  - time series
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: PostgreSQL alerting
weight: 500
---

# PostgreSQL alerting

The PostgreSQL data source supports [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/). You can create alert rules that evaluate time series queries against your PostgreSQL database and send notifications when conditions are met.

## Before you begin

- Ensure your [PostgreSQL data source is configured](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/configure/).
- Familiarize yourself with [Alert rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/) and [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Supported query format

Only **time series** queries can be used in alert rule conditions.

- Your query must return a column named `time` (native SQL date/time or UNIX epoch) and one or more numeric value columns.
- **Table** formatted queries are not supported in alert rule conditions.

For details on writing time series queries, refer to [Time series queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/query-editor/#time-series-queries) in the PostgreSQL query editor.

## Create an alert rule

To create an alert rule that uses PostgreSQL:

1. Go to **Alerting** (bell icon) in the left menu and select **Alert rules**.
1. Click **New alert rule**.
1. In the query section, select your **PostgreSQL** data source.
1. Set the query **Format** to **Time series**.
1. Write a SQL query that returns a `time` column and numeric value(s).
1. Configure the condition, evaluation group, and notification settings.
1. Save the rule.

For step-by-step guidance, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example time series query for alerting

The following query returns a time series suitable for a threshold alert (e.g. alert when value exceeds a limit):

```sql
SELECT
  $__timeGroupAlias("time_date_time", '5m'),
  avg("value_double") AS value
FROM test_data
WHERE $__timeFilter("time_date_time")
GROUP BY time
ORDER BY time
```

Use condition types such as **Is above** or **Is below** in the alert rule to evaluate the series.

## Template annotations and labels

You can use [template annotations and labels](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/) to include query results or metadata in alert notifications and labels.

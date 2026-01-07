---
aliases:
  - ../../data-sources/google-cloud-monitoring/alerting/
description: Set up alerts using Google Cloud Monitoring data in Grafana
keywords:
  - grafana
  - google
  - cloud
  - monitoring
  - alerting
  - alerts
  - metrics
  - slo
  - recording rules
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Google Cloud Monitoring alerting
weight: 450
refs:
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
  alerting-fundamentals:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/
  create-alert-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
  configure-gcm:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/configure/
  query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/query-editor/
  troubleshoot:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/troubleshooting/
  recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/
---

# Google Cloud Monitoring alerting

The Google Cloud Monitoring data source supports [Grafana Alerting](ref:alerting), allowing you to create alert rules based on GCP metrics and Service Level Objectives (SLOs). You can monitor your Google Cloud environment and receive notifications when specific conditions are met.

## Before you begin

Before you create alert rules, ensure the following:

- You have appropriate permissions to create alert rules in Grafana.
- Your Google Cloud Monitoring data source is configured and working correctly. Refer to [Configure the data source](ref:configure-gcm).
- You're familiar with [Grafana Alerting concepts](ref:alerting-fundamentals).

## Supported query types for alerting

The following query types support alerting:

| Query type                      | Use case                                              | Notes                                              |
| ------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| **Builder**                     | Threshold-based alerts on GCP resource metrics        | Best suited for alerting; returns time-series data |
| **MQL**                         | Complex metric queries using Monitoring Query Language | Use for advanced filtering and aggregations        |
| **Service Level Objectives (SLO)** | Alert on SLO compliance, error budgets, or burn rate | Monitor service reliability                        |
| **PromQL**                      | Prometheus-style queries on GCP metrics               | Familiar syntax for Prometheus users               |

{{< admonition type="note" >}}
Alert queries must return numeric data that Grafana can evaluate against a threshold. Queries that return only text or non-numeric data can't be used directly for alerting.
{{< /admonition >}}

## Authentication requirements

Alerting rules run as background processes without a user context. Both supported authentication methods work with alerting:

| Authentication method          | Supported |
| ------------------------------ | --------- |
| Google JWT File                | ✓         |
| GCE Default Service Account    | ✓         |

## Create an alert rule

To create an alert rule using Google Cloud Monitoring data:

1. Go to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for your alert rule.
1. In the **Define query and alert condition** section:
   - Select your Google Cloud Monitoring data source.
   - Configure your query (for example, a Builder query for CPU usage or an SLO query for error budget).
   - Add a **Reduce** expression if your query returns multiple series.
   - Add a **Threshold** expression to define the alert condition.
1. Configure the **Set evaluation behavior**:
   - Select or create a folder and evaluation group.
   - Set the evaluation interval (how often the alert is checked).
   - Set the pending period (how long the condition must be true before firing).
1. Add labels and annotations to provide context for notifications.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](ref:create-alert-rule).

## Example: VM CPU usage alert

This example creates an alert that fires when Compute Engine VM CPU utilization exceeds 80%:

1. Create a new alert rule.
1. Configure the query:
   - **Query type**: Builder
   - **Project**: Select your GCP project
   - **Service**: Compute Engine
   - **Metric**: `instance/cpu/utilization`
   - **Group by function**: mean
1. Add expressions:
   - **Reduce**: Last (to get the most recent data point)
   - **Threshold**: Is above 0.8 (CPU utilization is returned as a decimal)
1. Set evaluation to run every 1 minute with a 5-minute pending period.
1. Save the rule.

## Example: SLO error budget alert

This example alerts when an SLO's error budget remaining drops below 20%:

1. Create a new alert rule.
1. Configure the query:
   - **Query type**: Service Level Objectives (SLO)
   - **Project**: Select your GCP project
   - **Service**: Select your SLO service
   - **SLO**: Select your SLO
   - **Selector**: SLO Error Budget Remaining
1. Add expressions:
   - **Reduce**: Last
   - **Threshold**: Is below 0.2 (20% remaining)
1. Set evaluation to run every 5 minutes.
1. Save the rule.

## Example: Cloud SQL memory alert

This example alerts when Cloud SQL instance memory usage exceeds 90%:

1. Create a new alert rule.
1. Configure the query:
   - **Query type**: Builder
   - **Project**: Select your GCP project
   - **Service**: Cloud SQL
   - **Metric**: `database/memory/utilization`
   - **Filter**: Add a filter for specific database instances if needed
1. Add expressions:
   - **Reduce**: Last
   - **Threshold**: Is above 0.9
1. Set evaluation to run every 1 minute.
1. Save the rule.

## Best practices

Follow these recommendations to create reliable and efficient alerts with Google Cloud Monitoring data.

### Use appropriate query intervals

- Set the alert evaluation interval to be greater than or equal to the minimum data resolution from Google Cloud Monitoring.
- Most GCP metrics have 1-minute granularity at minimum.
- Avoid very short intervals (less than 1 minute) as they may cause evaluation timeouts or miss data points.

### Reduce multiple series

When your query returns multiple time series (for example, CPU usage across multiple VMs), use the **Reduce** expression to aggregate them:

- **Last**: Use the most recent value
- **Mean**: Average across all series
- **Max/Min**: Use the highest or lowest value
- **Sum**: Total across all series

### Use appropriate alignment periods

For alerting queries, ensure the alignment period provides enough data points:

- Use "cloud monitoring auto" or "grafana auto" for most cases.
- For more precise control, set a fixed alignment period that matches your evaluation interval.

### Handle no data conditions

Configure what happens when no data is returned:

1. In the alert rule, find **Configure no data and error handling**.
1. Choose an appropriate action:
   - **No Data**: Keep the alert in its current state
   - **Alerting**: Treat no data as an alert condition
   - **OK**: Treat no data as a healthy state

### Test queries before alerting

Always verify your query returns expected data before creating an alert:

1. Go to **Explore**.
1. Select your Google Cloud Monitoring data source.
1. Run the query you plan to use for alerting.
1. Confirm the data format and values are correct.
1. Verify the query returns numeric data suitable for threshold evaluation.

## Recording rules

The Google Cloud Monitoring data source supports [Grafana-managed recording rules](ref:recording-rules). Recording rules periodically pre-compute frequently used or computationally expensive queries, saving the results as a new time series metric.

Use recording rules to:

- Reduce query load on Google Cloud Monitoring by pre-computing complex aggregations.
- Create derived metrics from GCP data for use in alerts and dashboards.
- Import Google Cloud Monitoring data into a Prometheus-compatible database.

{{< admonition type="note" >}}
Grafana-managed recording rules write results to a Prometheus-compatible database (such as Grafana Mimir or the Grafana Cloud managed Prometheus). You must configure a target data source for storing the recorded metrics.
{{< /admonition >}}

For instructions on creating recording rules, refer to [Create recording rules](ref:recording-rules).

## Troubleshooting

If your Google Cloud Monitoring alerts aren't working as expected, use the following sections to diagnose and resolve common issues.

### Alerts not firing

- Check that the query returns numeric data in Explore.
- Ensure the evaluation interval allows enough time for data to be available.
- Verify the threshold is set correctly (remember that many GCP metrics return decimals, not percentages).
- Review the alert rule's health and any error messages in the Alerting UI.

### Authentication errors in alert evaluation

If you see authentication errors when alerts evaluate:

- Verify the service account has the **Monitoring Viewer** role.
- If using a JWT key file, ensure it hasn't been deleted or revoked.
- Check that the required APIs (Monitoring API, Cloud Resource Manager API) are enabled.

### Query timeout errors

- Increase the alignment period to reduce the number of data points.
- Reduce the time range in the query.
- Simplify complex MQL queries.
- Add filters to narrow the result set.

For additional troubleshooting help, refer to [Troubleshoot Google Cloud Monitoring](ref:troubleshoot).

## Additional resources

- [Grafana Alerting documentation](ref:alerting)
- [Create alert rules](ref:create-alert-rule)
- [Create recording rules](ref:recording-rules)
- [Google Cloud Monitoring query editor](ref:query-editor)


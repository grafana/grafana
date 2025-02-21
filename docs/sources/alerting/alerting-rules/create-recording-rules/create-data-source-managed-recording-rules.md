---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/create-data-source-managed-recording-rules/
description: Recording rules allow you to pre-compute expensive queries in advance and save the results as a new set of time series. Data source-managed recording rules can create a recording rule for Prometheus-based data sources like Mimir or Loki.
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
title: Create data source-managed recording rules
weight: 402
refs:
  create-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/
---

# Create data source-managed recording rules

[Recording rules](ref:create-recording-rules) allow you to periodically pre-compute frequently used or computationally expensive queries, saving the results as a new time series metric.

Alert rules and dashboards can then query the new metric resulting from the recording rule. This is faster than querying real-time data and can help to reduce system load.

Data source-managed recording rules can query Prometheus-based data sources like Mimir or Loki. For more information on recording rules in Prometheus, refer to [Defining recording rules in Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/).

Note that in data source-managed groups, the alert rules and recording rules within the same evaluation group are evaluated sequentially. This is useful to ensure that a recording rule is evaluated before any other alert rule queries the pre-computed metric.

## Before you begin

- Verify that you have write permission to the Prometheus or Loki data source. Otherwise, you will not be able to create or update Grafana Mimir managed alerting rules.

- For Grafana Mimir and Loki data sources, enable the ruler API by configuring their respective services.

  - **Loki** - The `local` rule storage type, default for the Loki data source, supports only viewing of rules. To edit rules, configure one of the other rule storage types.

  - **Mimir** - use the `/prometheus` prefix. The Prometheus data source supports both Grafana Mimir and Prometheus, and Grafana expects that both the [Query API](/docs/mimir/latest/operators-guide/reference-http-api/#querier--query-frontend) and [Ruler API](/docs/mimir/latest/operators-guide/reference-http-api/#ruler) are under the same URL. You cannot provide a separate URL for the Ruler API.

## Add new recording rule

To create a new data source-managed recording rule:

1. Click **Alerts & IRM** -> **Alerting** -> **Alert rules**.
1. Scroll to the **Data source-managed section** and click **+New recording rule**.

## Enter recording rule name

The recording rule name must be a Prometheus metric name and contain no whitespace.

## Define recording rule

Select your data source and enter a query. The queries used in data source-managed recording rules always run as instant queries.

## Add namespace and group

1. From the **Namespace** dropdown, select an existing rule namespace or add a new one.

   Namespaces can contain one or more rule groups and only have an organizational purpose.

1. From the **Group** dropdown, select an existing group within the selected namespace or add a new one.

   Rules within a group are run sequentially at a regular interval, with the same evaluation time.

   Newly created rules are appended to the end of the group, and you can reorder them from the **Alert rules** page.

## Add labels

Optionally, you can add custom labels to the resulting metric by selecting existing key-value pairs from the drop down or entering the new key or value.

## Query the new metric in dashboards or alert rules

Click **Save rule** or **Save rule and exit** to save the rule.

Once saved, the new recording metric is available for use in dashboards and alert rules.

---
aliases:
  - ../unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/
  - ../unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
description: Create recording rules for an external Grafana Mimir or Loki instance
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
title: Configure recording rules
weight: 300
refs:
  configure-grafana:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/
  annotation-label:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
---

# Configure recording rules

Recording rules calculate frequently needed expressions or computationally expensive expressions in advance and save the result as a new set of time series. Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh.

Grafana-managed recording rules offer the same Prometheus-like semantics, but allow you to query any Grafana data source supported by alerting. In addition to the above, you can use this to import and map data from other data sources into Prometheus.

For more information on recording rules in Prometheus, refer to [Defining recording rules in Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/).

## Configure data source-managed recording rules

Configure data source-managed recording rules.

### Before you begin

- Verify that you have write permission to the Prometheus or Loki data source. Otherwise, you will not be able to create or update Grafana Mimir managed alerting rules.

- For Grafana Mimir and Loki data sources, enable the ruler API by configuring their respective services.

  - **Loki** - The `local` rule storage type, default for the Loki data source, supports only viewing of rules. To edit rules, configure one of the other rule storage types.

  - **Grafana Mimir** - use the `/prometheus` prefix. The Prometheus data source supports both Grafana Mimir and Prometheus, and Grafana expects that both the [Query API](/docs/mimir/latest/operators-guide/reference-http-api/#querier--query-frontend) and [Ruler API](/docs/mimir/latest/operators-guide/reference-http-api/#ruler) are under the same URL. You cannot provide a separate URL for the Ruler API.

To configure data-source managed recording rules, complete the following steps.

1. Click **Alerts & IRM** -> **Alerting** ->
   **Alert rules**.
1. Scroll to the **Data source-managed section** and click **+New recording rule**.

#### Enter recording rule name

The recording rule name must be a Prometheus metric name and contain no whitespace.

#### Define recording rule

Select your data source and enter a query. The queries used in data source-managed recording rules always run as instant queries.

#### Add namespace and group

1. From the **Namespace** dropdown, select an existing rule namespace or add a new one.

   Namespaces can contain one or more rule groups and only have an organizational purpose.

1. From the **Group** dropdown, select an existing group within the selected namespace or add a new one.

   Newly created rules are appended to the end of the group. Rules within a group are run sequentially at a regular interval, with the same evaluation time.

#### Add labels

1. Add custom labels selecting existing key-value pairs from the drop down, or add new labels by entering the new key or value.

1. Click **Save rule** to save the rule or **Save rule and exit** to save the rule and go back to the Alerting page.

## Configure Grafana-managed recording rules

Configure Grafana-managed recording rules.

{{< admonition type="note" >}}
In Grafana OSS and Enterprise, you can create Grafana-managed recording rules if you enable the `grafanaManagedRecordingRules` feature flag.
For Grafana Cloud, it is enabled by default.

For more information on enabling feature toggles, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles).
{{< /admonition >}}

### Before you begin

- Enable the `grafanaManagedRecordingRules` [feature flag](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

Grafana does not contain an embedded time-series database. You must bring your own Prometheus-compatible database to store series generated by Grafana-managed recording rules.

First, enable the feature by setting `enabled = true` in the `[recording_rules]` section of the Grafana config .ini. Then, provide the URL of your Prometheus-compatible remote-write endpoint in the `url` field, along with optional credentials or headers.

```
[recording_rules]
enabled = true
url = http://my-example-prometheus.local:9090/api/prom/push
basic_auth_username = my-user
basic_auth_password = my-pass

[recording_rules.custom_headers]
X-My-Header = MyValue
```

You must provide a URL if `enabled` is set to `true`.

To configure Grafana-managed recording rules, complete the following steps.

1. Click **Alerts & IRM** -> **Alerting** ->
   **Alert rules**.
1. Scroll to the **Grafana-managed section** and click **+New recording rule**.

#### Enter a recording rule and metric name

Enter a names to identify your recording rule and metric. The metric name must be a Prometheus metric name and contain no whitespace.

For more information, refer to [Metrics and labels](https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).

#### Define recording rule

Define a query to get the data you want to measure and set the recording rule output.

1. Select a data source.
1. From the **Options** dropdown, specify a time range.

{{< admonition type="note" >}}
Grafana Alerting only supports fixed relative time ranges, for example, `now-24hr: now`.

It does not support absolute time ranges: `2021-12-02 00:00:00 to 2021-12-05 23:59:592` or semi-relative time ranges: `now/d to: now`.
{{< /admonition >}}

1. Add a query.

   To add multiple queries, click **Add query**.

2. Add one or more [expressions].

   a. For each expression, select either **Classic condition** to create a single recording rule, or choose from the **Math**, **Reduce**, and **Resample** options.

   {{% admonition type="note" %}}
   When using Prometheus, you can use an instant vector and built-in functions, so you don't need to add additional expressions.
   {{% /admonition %}}

   b. Click **Preview** to verify that the expression is successful.

3. Click **Set as recording rule output** on the query or expression you want to set as your rule output.

#### Set evaluation behavior

Use recording rule evaluation to determine how frequently a recording rule should be evaluated.

To do this, you need to make sure that your recording rule is in the right evaluation group with an interval that works best for your use case.

1. Select a folder or click **+ New folder**.
1. Select an evaluation group or click **+ New evaluation group**.

   If you are creating a new evaluation group, specify the interval for the group.

   All rules within the same group are evaluated concurrently over the same time interval. Every recording rule in a group uses the same evaluation time, meaning that all queries from the same group are always aligned with each other.

1. Turn on pause recording rule evaluation, if required.

   {{< admonition type="note" >}}
   You can pause recording rule evaluation.
   {{< /admonition >}}

#### Add labels

1. Add custom labels selecting existing key-value pairs from the drop down, or add new labels by entering the new key or value.

1. Click **Save rule** to save the rule or **Save rule and exit** to save the rule and go back to the Alerting page.

#### Advanced Configuration

[min_interval](ref:configure-grafana) sets the minimum interval to enforce between rule evaluations. The default value is 10s which equals the scheduler interval. Rules are adjusted if they are less than this value or if they are not multiple of the scheduler interval (10s). Higher values can help with resource management as fewer evaluations are scheduled over time.

This setting has precedence over each individual rule frequency. If a rule frequency is lower than this value, then this value is enforced.

This setting applies to both Grafana-managed alert and recording rules.

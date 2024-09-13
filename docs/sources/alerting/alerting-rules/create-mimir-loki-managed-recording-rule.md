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

{{< admonition type="note" >}}
In Grafana Cloud, you can only create data source-managed recording rules.

In Grafana OSS and Enterprise, you can create both Grafana-managed and data source-managed recording rules if you enable the `grafanaManagedRecordingRules` feature flag.

For more information on enabling feature toggles, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles).
{{< /admonition >}}

Recording rules calculate frequently needed expressions or computationally expensive expressions in advance and save the result as a new set of time series. Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh.

For more information on recording rules in Prometheus, refer to [Defining recording rules in Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/).

Recording rules are run as instant rules, which means that they run every 10s. To overwrite this configuration, update the min_interval in your custom configuration file.

[min_interval](ref:configure-grafana) sets the minimum interval to enforce between rule evaluations. The default value is 10s which equals the scheduler interval. Rules will be adjusted if they are less than this value or if they are not multiple of the scheduler interval (10s). Higher values can help with resource management as fewer evaluations are scheduled over time.

This setting has precedence over each individual rule frequency. If a rule frequency is lower than this value, then this value is enforced.

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

Select your data source and enter a query.

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
This feature is only available for Grafana OSS and Enterprise users. It is not available in Grafana Cloud.
{{< /admonition >}}

### Before you begin

- Enable the `grafanaManagedRecordingRules` [feature flag](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

To configure Grafana-managed recording rules, complete the following steps.

1. Click **Alerts & IRM** -> **Alerting** ->
   **Alert rules**.
1. Scroll to the **Grafana-managed section** and click **+New recording rule**.

#### Enter a recording rule and metric name

Enter a names to identify your recording rule and metric. The metric name must be a Prometheus metric name and contain no whitespace.

For more information, refer to [Metrics and labels](https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).

#### Define recording rule

Define a query to get the data you want to measure and a condition that needs to be met before an alert rule fires.

1. Select a data source.
1. From the **Options** dropdown, specify a time range.

{{< admonition type="note" >}}
Grafana Alerting only supports fixed relative time ranges, for example, `now-24hr: now`.

It does not support absolute time ranges: `2021-12-02 00:00:00 to 2021-12-05 23:59:592` or semi-relative time ranges: `now/d to: now`.
{{< /admonition >}}

1. Add a query.

   To add multiple queries, click **Add query**.

   All alert rules are managed by Grafana by default. If you want to switch to a data source-managed alert rule, click **Switch to data source-managed alert rule**.

2. Add one or more [expressions].

   a. For each expression, select either **Classic condition** to create a single alert rule, or choose from the **Math**, **Reduce**, and **Resample** options to generate separate alert for each series.

   {{% admonition type="note" %}}
   When using Prometheus, you can use an instant vector and built-in functions, so you don't need to add additional expressions.
   {{% /admonition %}}

   b. Click **Preview** to verify that the expression is successful.

3. To add a recovery threshold, turn the **Custom recovery threshold** toggle on and fill in a value for when your alert rule should stop firing.

   You can only add one recovery threshold in a query and it must be the alert condition.

4. Click **Set as alert condition** on the query or expression you want to set as your alert condition.

#### Set evaluation behavior

Use alert rule evaluation to determine how frequently an alert rule should be evaluated and how quickly it should change its state.

To do this, you need to make sure that your alert rule is in the right evaluation group and set a pending period time that works best for your use case.

1. Select a folder or click **+ New folder**.
1. Select an evaluation group or click **+ New evaluation group**.

   If you are creating a new evaluation group, specify the interval for the group.

   All rules within the same group are evaluated concurrently over the same time interval.

1. Enter a pending period.

   The pending period is the period in which an alert rule can be in breach of the condition until it fires.

   Once a condition is met, the alert goes into the **Pending** state. If the condition remains active for the duration specified, the alert transitions to the **Firing** state, else it reverts to the **Normal** state.

1. Turn on pause alert notifications, if required.

   {{< admonition type="note" >}}
   You can pause alert rule evaluation to prevent noisy alerting while tuning your alerts.
   Pausing stops alert rule evaluation and doesn't create any alert instances.
   This is different to mute timings, which stop notifications from being delivered, but still allows for alert rule evaluation and the creation of alert instances.
   {{< /admonition >}}

#### Add labels

Add labels to your rule for searching, silencing, or routing to a notification policy.

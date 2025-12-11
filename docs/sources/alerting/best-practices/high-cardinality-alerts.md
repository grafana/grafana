---
canonical: https://grafana.com/docs/grafana/latest/alerting/best-practices/high-cardinality-alerts/
description: Learn how to detect and alert on high-cardinality metrics that can overload your metrics backend and increase observability costs.
keywords:
  - grafana
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Examples of high-cardinality alerts
title: Examples of high-cardinality alerts
weight: 1105
refs:
  usage-cost-alerts:
    - pattern: /docs/
      destination: /docs/grafana-cloud/cost-management-and-billing/usage-cost-alerts/
  planning-mimir-capacity:
    - pattern: /docs/
      destination: /docs/mimir/latest/manage/run-production-environment/planning-capacity/
  adaptative-metrics:
    - pattern: /docs/
      destination: /docs/grafana-cloud/adaptive-telemetry/adaptive-metrics/introduction/
  cloud-metrics-invoice:
    - pattern: /docs/
      destination: /docs/grafana-cloud/cost-management-and-billing/manage-invoices/understand-your-invoice/metrics-invoice/
  multi-dimensional-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/multi-dimensional-alerts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/multi-dimensional-alerts/
---

# Examples of high-cardinality alerts

In Prometheus and Mimir, metrics are stored as time series, where each unique set of labels defines a distinct series.

A large number of unique series (_high cardinality_) can overload your metrics backend, slow down dashboard and alert queries, and quickly increase your observability costs or exceed the limits of your Grafana Cloud plan.

These examples show how to detect and alert on early signs of high cardinality:

- **Total active series near limits**: detect when your Prometheus, Mimir, or Grafana Cloud Metrics instance approaches soft or hard limits.
- **Series increase per metric or scope:** fine-tune detection to identify growth in a particular metric or domain.
- **Sudden series growth**: detect runaway cardinality increases caused by misconfigured exporters or new deployments.
- **High ingestion rate**: detect when too many samples per second are being ingested, even if the total series count is stable.

Use these alert patterns to act on high-cardinality growth, and consider implementing [Adaptive Metrics recommendations](ref:adaptative-metrics) to keep your observability costs under control.

## Choose metrics to monitor active series

First, identify which metric reports the number of active time series.

Prometheus, Mimir, and Grafana Cloud expose this information differently:

| Environment             | Metric                                | Description                                                                                                                                                                                 |
| :---------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Prometheus**          | `prometheus_tsdb_head_series`         | Reports the number of active series currently stored in memory (the head block) of a single Prometheus instance. It includes series that have stopped receiving samples for up to one hour. |
| **Grafana Cloud**       | `grafanacloud_instance_active_series` | Tracks the number of [active series in your Grafana Cloud Metrics backend (Mimir](ref:cloud-metrics-invoice)).                                                                              |
| **Prometheus or Mimir** | `count({__name__!=""})`               | Counts the number of series with recent samples by scanning the TSDB index. This query is expensive and should be exposed through a recording rule.                                         |

## Detect total active series near limits

A high number of active series increases memory usage and can impact performance. Grafana Cloud enforces usage limits to prevent your instance from running into these performance issues.

In Prometheus, you can alert when the total number of active series exceeds a threshold:

```shell
prometheus_tsdb_head_series > 1.5e6
```

This fires when the instance exceeds 1.5 million active series.  
Adjust the threshold based on the capacity of your Prometheus host and observed load.

In Grafana Cloud, use the `grafanacloud_instance_active_series` metric to monitor active series across your managed Mimir backend:

```shell
grafanacloud_instance_active_series > 1.5e6
```

Grafana Cloud also provides account-level limits through the `grafanacloud_instance_metrics_limits` metric.

For more robust alerting, you can compare your current usage to the `max_global_series_per_user` limit:

```shell
(
  grafanacloud_instance_active_series
  / on (id)
    grafanacloud_instance_metrics_limits{limit_name="max_global_series_per_user"}
)
* on (id) group_left(name) grafanacloud_instance_info
> 0.9

```

- `grafanacloud_instance_active_series`  
  Returns the current number of active series per your Mimir (Prometheus) data source instance (`id`).

- `/ on (id) grafanacloud_instance_metrics_limits{limit_name="max_global_series_per_user"}`  
  Divides current usage by the account limit to calculate a utilization ratio between 0 and 1 (where `1` means the limit is reached).

- `* on (id) group_left(name) grafanacloud_instance_info`  
  Joins instance metadata to display the instance name.

- `> 0.9`  
  Defines the threshold condition to fire when usage exceeds 90% of the limit.  
  Adjust this value according to your alert goal. Alternatively, you can set the threshold as a Grafana Alerting expression in the UI.

## Detect high-cardinality per metric

Instead of monitoring the total number of active series, you can fine-tune alerts to detect high cardinality within a specific scope — for example, by filtering on certain namespaces, services, or metrics known to generate many label combinations.

[Multi-dimensional alerts](ref:multi-dimensional-example) let you evaluate each metric independently, so you can identify which metric is responsible for the label explosion instead of only tracking the overall total.

You can apply label filters, or use `{__name__=~"regex"}` to select specific metrics. Then, use `count by (__name__)` to group results per metric name.

Because the `__name__` selector queries the entire TSDB index, it’s recommended to query this using a **recording rule**:

```shell
# Only HTTP/RPC-style metrics
active_series_per_metric:http_rpc =
label_replace(
  count by (__name__) ({__name__=~"http_.*|rpc_.*"}),
  "metric", "$1", "__name__", "(.*)"
)
```

This recording rule stores the number of active series per metric name.

- `count by (__name__) ({__name__=~"http_.*|rpc_.*"})`  
  Counts the number of active series per metric matching the `http_.*` or `rpc_.*` regex.

- `label_replace(..., "metric", "$1", "__name__", "(.*)")`  
  Copies the metric name into a new label called `metric`.  
  This enables generating one alert instance per metric because `__name__` is not treated as a regular label.

Adjust the threshold and recording rule scope based on the label usage and normal behavior of your observed metrics.

After the recording rule is available, you can define this multi-dimensional alert rule as follows:

```shell
active_series_per_metric:http_rpc > 100
```

Grafana Alerting evaluates each row (or time series) returned by the `active_series_per_metric:http_rpc` recording rule as a separate alert instance, producing independent alert instance states:

| Alert instance                       | Value | State  |
| :----------------------------------- | :---- | :----- |
| `{metric="http_requests_total"}`     | 320   | Firing |
| `{metric="rpc_client_calls_total"}`  | 45    | Normal |
| `{metric="rpc_server_errors_total"}` | 110   | Firing |

Each metric name (`__name__`) becomes a separate alert instance, so you immediately see which metric exceeds the expected limit.

## Detect sudden cardinality growth

Even if the number of active series stays within proper limits, a sudden increase can signal a misbehaving exporter, a new deployment, or an unexpected label explosion. These peaks can help you prevent potential issues, or just inform you of deployment changes that might need adjustments.

You can use any of the metrics from the previous examples to track short-term changes in the total active series:

```shell
delta(active_series_metric[10m]) > 1000
```

This alert fires when the number of active series increases by more than **1000** within the last 10 minutes.  
Adjust the time window (for example, `[5m]` or `[30m]`) and threshold to match your environment’s normal variability.

## Detect high ingestion rate

Even if label cardinality remains under control, a high ingestion rate can affect Prometheus performance or increase observability costs.

In Prometheus, this usually happens when scrapes occur too frequently or when exporters generate large numbers of samples in short intervals.

To find an appropriate threshold to be alerted, start by monitoring normal ingestion peaks and set the threshold to a value that stays below the point where scrapes or WAL operations begin to slow down.

In Prometheus, use the `prometheus_tsdb_head_samples_appended_total` metric to measure the number of samples appended per scrape:

```shell
rate(prometheus_tsdb_head_samples_appended_total[10m]) > 1e5
```

The alert rule query returns the average ingestion rate per second over the last 10 minutes and fires when the value exceeds 100 000 samples per second.

In Grafana Cloud, use the `grafanacloud_instance_samples_per_second` metric to monitor total ingestion rate of your Mimir instances:

```shell
grafanacloud_instance_samples_per_second
  * on (id) group_left(name) grafanacloud_instance_info
> 1e5
```

Alternatively, Grafana Cloud metrics limits are based on [data points per minute (DPM)](ref:cloud-metrics-invoice): the number of samples sent per minute across all your active series.

To monitor when your actual data-point rate approaches your DPM limit, you can compare total ingestion to your plan’s DPM limit:

```shell
(
  (grafanacloud_instance_samples_per_second * 60)
  / grafanacloud_org_metrics_included_dpm_per_series
)
> 0.9

```

- `(grafanacloud_instance_samples_per_second * 60)`  
  Converts ingestion rate from data points per second to minutes.

- `/ grafanacloud_org_metrics_included_dpm_per_series`  
  Divides current DPM usage by the DPM limit to calculate a utilization ratio between 0 and 1 (where `1` means the limit is reached).

- `> 0.9`  
  Defines the threshold condition to fire when the usage exceeds 90% of the DPM limit.

This alert helps you detect when your organization is ingesting data faster and approaching its limits. Use ingestion rate alerts to detect workload spikes, exporter misconfigurations, or rapid increases in ingestion volume and cost.

## Learn more

Here’s list of additional resources related to this example:

- [Multi-dimensional alerting example](ref:multi-dimensional-example) – Learn how Grafana creates separate alert instances for each unique label set.
- [Understand Grafana Cloud active series and DPM](ref:cloud-metrics-invoice)– See how active series and data points per minute (DPM) are used to calculate metrics usage in Grafana Cloud.
- [Create Grafana Cloud usage alerts](ref:usage-cost-alerts) – Set up alerts when your usage or costs approach your predefined limits.
- [Plan capacity for Mimir](ref:planning-mimir-capacity)– Learn how to plan ingestion rate and memory capacity for Mimir or Prometheus environments.
- [Adaptive Metrics recommendations](ref:adaptative-metrics) – Use Adaptive Metrics to automatically reduce high-cardinality metrics and control observability costs.

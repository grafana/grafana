---
aliases:
  - ../../data-sources/google-cloud-monitoring/query-editor/
description: Guide for using the Google Cloud Monitoring data source's query editor
keywords:
  - grafana
  - google
  - cloud
  - monitoring
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: Google Cloud Monitoring query editor
weight: 300
refs:
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
  add-template-variables-add-interval-variable:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-an-interval-variable
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-an-interval-variable
---

# Google Cloud Monitoring query editor

This topic explains querying specific to the Google Cloud Monitoring data source.
For general documentation on querying data sources in Grafana, see [Query and transform data](ref:query-transform-data).

## Query types

The Google Cloud Monitoring query editor supports the following query types:

| Query type                              | Description                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [**Builder**](#query-metrics)           | Build metrics queries visually by selecting a service, metric, filters, and aggregation options. |
| [**MQL**](#use-the-monitoring-query-language) | Write queries using the Monitoring Query Language for advanced use cases.                   |
| [**Service Level Objectives (SLO)**](#query-service-level-objectives) | Query SLO data to track service reliability and error budgets. |
| [**PromQL**](#query-with-promql)        | Write Prometheus-style queries against Google Cloud Monitoring metrics.                          |

## Query metrics

{{< figure src="/static/img/docs/google-cloud-monitoring/metric-query-builder-8-0.png" max-width="400px" class="docs-image--no-shadow" caption="Google Cloud Monitoring metrics query builder" >}}

The metrics query editor helps you select metrics, group and aggregate by labels and time, and use filters to specify which time series you want to query.

### Create a metrics query

1. Select **Builder** in the **Query type** dropdown.
1. Select a project from the **Project** dropdown.
1. Select a Google Cloud Platform service from the **Service** dropdown.
1. Select a metric from the **Metric** dropdown.
1. _(Optional)_ Use the plus and minus icons in the filter and group-by sections to add and remove filters or group-by clauses.

Google Cloud Monitoring supports several metrics types, such as `GAUGE`, `DELTA,` and `CUMULATIVE`.
Each supports different aggregation options, such as reducers and aligners. Additionally, metrics have specific value types that can be either scalar or a distribution.

The metrics query editor lists available aggregation methods for a selected metric, and sets a default aggregation, reducer and aligner when you select a metric.

In the case that the metric value type is a distribution, the aggregation will be set by default to the mean. For scalar value types, there is no aggregation by default.

The various metrics are documented [here](https://cloud.google.com/monitoring/api/metrics_gcp) and further details on the kinds and types of metrics can be found [here](https://cloud.google.com/monitoring/api/v3/kinds-and-types).

{{< admonition type="note" >}}
Distribution metrics are typically best visualized as either a heatmap or histogram. When visualizing in this way, aggregation is not necessary. However, for other visualization types, performance degradation may be observed when attempting to query distribution metrics that are not aggregated due to the number of potential buckets that can be returned. For more information on how to visualize distribution metrics refer to [this page](https://cloud.google.com/monitoring/charts/charting-distribution-metrics).
{{< /admonition >}}

### Apply a filter

**To add and apply a filter:**

1. Click the plus icon in the filter section.
1. Select a field to filter by.
1. Enter a filter value, such as `instance_name = grafana-1`.

To remove the filter, click the trash icon.

#### Use simple wildcards

When you set the operator to `=` or `!=`, you can add wildcards to the filter value field.

For example, entering `us-*` captures all values that start with "us-", and entering `*central-a` captures all values that end with "central-a".
`*-central-*` captures all values with the substring of "-central-".

Simple wildcards perform better than regular expressions.

#### Use regular expressions

When you set the operator to `=~` or `!=~`, you can add regular expressions to the filter value field.

For example, entering `us-central[1-3]-[af]` matches all values that start with "us-central", then are followed by a number in the range of 1 to 3, a dash, and then either an "a" or an "f".

You don't need leading and trailing slashes when you create these regular expressions.

### Configure pre-processing options

The query editor displays pre-processing options when the selected metric has a metric type of `DELTA` or `CUMULATIVE`.

- The **Rate** option aligns and converts data points to a rate per time series.
- The **Delta** option aligns data points by their delta (difference) per time series.

### Group time series

To combine multiple time series and reduce the amount of data returned for a metric, specify a grouping and a function.

#### Group by

Use the **Group By** segment to group resource or metric labels, which reduces the number of time series and aggregates the results by group.

For example, if you group by `instance_name`, Grafana displays an aggregated metric for the specified Compute instance.

##### Metadata labels

Resource metadata labels contain information that can uniquely identify a resource in Google Cloud.
A time series response returns metadata labels only if they're part of the Group By segment in the time series request.

There's no API for retrieving metadata labels, so you can't populate the Group By list with the metadata labels that are available for the selected service and metric.
However, the **Group By** field list comes with a pre-defined set of common system labels.

You can't pre-define user labels, but you can enter them manually in the **Group By** field.
If you include a metadata label, user label, or system label in the **Group By** segment, you can create filters based on it and expand its value on the **Alias** field.

#### Group by function

To combine the time series in the group into a single time series, select a grouping function.

### Align data

You can align all data points received in a fixed length of time by applying an alignment function to combine those data points, and then assigning a timestamp to the result.

#### Select an alignment function

During alignment, all data points are received in a fixed interval.
Within each interval, as defined by the [alignment period](#alignment-period)), and for each time series, the data is aggregated into a single point.
The value of that point is determined by the type of alignment function you use.

For more information on alignment functions, refer to [alignment metric selector](https://cloud.google.com/monitoring/charts/metrics-selector#alignment).

#### Define the alignment period

You can set the **Alignment Period** field to group a metric by time if you've chosen an aggregation.

The default, called "cloud monitoring auto", uses GCP Google Cloud Monitoring's default groupings.
These enable you to compare graphs in Grafana with graphs in the Google Cloud Monitoring UI.

The default values for "cloud monitoring auto" are:

- 1m for time ranges < 23 hours
- 5m for time ranges >= 23 hours and < 6 days
- 1h for time ranges >= 6 days

The other automatic option is "grafana auto", which automatically sets the Group By time depending on the time range chosen and width of the time series panel.

For more information about "grafana auto", refer to [Interval variable](ref:add-template-variables-add-interval-variable).

You can also choose fixed time intervals to group by, like `1h` or `1d`.

### Set alias patterns

The **Alias By** helps you control the format of legend keys.
By default, Grafana shows the metric name and labels, which can be long and difficult to read.

You can use patterns in the alias field to customize the legend key's format:

| Alias pattern                    | Description                                      | Alias pattern example             | Example result                                    |
| -------------------------------- | ------------------------------------------------ | --------------------------------- | ------------------------------------------------- |
| `{{metric.label.xxx}}`           | Returns the metric label value.                  | `{{metric.label.instance_name}}`  | `grafana-1-prod`                                  |
| `{{metric.type}}`                | Returns the full Metric Type.                    | `{{metric.type}}`                 | `compute.googleapis.com/instance/cpu/utilization` |
| `{{metric.name}}`                | Returns the metric name part.                    | `{{metric.name}}`                 | `instance/cpu/utilization`                        |
| `{{metric.service}}`             | Returns the service part.                        | `{{metric.service}}`              | `compute`                                         |
| `{{resource.label.xxx}}`         | Returns the resource label value.                | `{{resource.label.zone}}`         | `us-east1-b`                                      |
| `{{resource.type}}`              | Returns the name of the monitored resource type. | `{{resource.type}}`               | `gce_instance`                                    |
| `{{metadata.system_labels.xxx}}` | Returns the metadata system label value.         | `{{metadata.system_labels.name}}` | `grafana`                                         |
| `{{metadata.user_labels.xxx}}`   | Returns the metadata user label value.           | `{{metadata.user_labels.tag}}`    | `production`                                      |

#### Alias pattern examples

**Using metric labels:**

You can select from a list of metric and resource labels for a metric in the Group By dropdown.
You can then include them in the legend key using alias patterns.

For example, given this value of Alias By: `{{metric.type}} - {{metric.label.instance_name}}`

An expected result would look like: `compute.googleapis.com/instance/cpu/usage_time - server1-prod`

**Using the Monitored Resource Type:**

You can also resolve the name of the Monitored Resource Type with the `resource.type` alias.

For example, given this value of Alias By: `{{resource.type}} - {{metric.type}}`

An expected result would look like: `gce_instance - compute.googleapis.com/instance/cpu/usage_time`

### Deep-link from Grafana panels to the Google Cloud Console Metrics Explorer

{{< figure src="/static/img/docs/v71/cloudmonitoring_deep_linking.png" max-width="500px" class="docs-image--no-shadow" caption="Google Cloud Monitoring deep linking" >}}

You can click on a time series in the panel to access a context menu, which contains a link to **View in Metrics Explorer in Google Cloud Console**.
The link points to the Google Cloud Console's Metrics Explorer and runs the Grafana panel's query there.

If you select the link, you first select an account in the Google Account Chooser.
Google then redirects you to the Metrics Explorer.

The provided link is valid for any account, but displays the query only if your account has access to the query's specified GCP project.

### Understand automatic unit detection

Grafana issues one query to the Cloud Monitoring API per query editor row, and each API response includes a unit.
Grafana attempts to convert the returned unit into a unit compatible with its time series panel.

If successful, Grafana displays the unit on the panel's Y-axis.
If the query editor rows return different units, Grafana uses the unit from the last query editor row in the time series panel.

### Use the Monitoring Query Language

The Monitoring Query Language (MQL) query builder helps you query and display MQL results in time series format.
To understand basic MQL concepts, refer to [Introduction to Monitoring Query Language](https://cloud.google.com/monitoring/mql).

#### Create an MQL query

**To create an MQL query:**

1. Select **MQL** in the **Query type** dropdown.
1. Select a project from the **Project** dropdown.
1. Enter your MQL query in the text area.
1. _(Optional)_ Configure the **Graph period** setting.

Press `Shift+Enter` to run the query.

#### Configure MQL options

The following options are available for MQL queries:

| Setting          | Description                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alias by**     | Control the format of legend keys. Refer to [Set alias patterns for MQL queries](#set-alias-patterns-for-mql-queries) for available patterns.  |
| **Graph period** | Enable the toggle to override the default time period. Select a period from the dropdown to control the granularity of the returned time series data. |

### Set alias patterns for MQL queries

MQL queries use the same alias patterns as [metric queries](#set-alias-patterns).

However, `{{metric.service}}` is not supported, and `{{metric.type}}` and `{{metric.name}}` show the time series key in the response.

## Query Service Level Objectives

{{< figure src="/static/img/docs/google-cloud-monitoring/slo-query-builder-8-0.png" max-width="400px" class="docs-image--no-shadow" caption="Service Level Objectives (SLO) query editor" >}}

The SLO query builder helps you visualize SLO data in time series format.
To understand basic concepts in service monitoring, refer to the [Google Cloud Monitoring documentation](https://cloud.google.com/monitoring/service-monitoring).

### Create an SLO query

**To create an SLO query:**

1. Select **Service Level Objectives (SLO)** in the **Query type** dropdown.
1. Select a project from the **Project** dropdown.
1. Select an [SLO service](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/services) from the **Service** dropdown.
1. Select an [SLO](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/services.serviceLevelObjectives) from the **SLO** dropdown.
1. Select a [time series selector](https://cloud.google.com/stackdriver/docs/solutions/slo-monitoring/api/timeseries-selectors#ts-selector-list) from the **Selector** dropdown.

Grafana's time series selectors use descriptive names that map to system names that Google uses in the Service Monitoring documentation:

| Selector dropdown value        | Corresponding time series selector |
| ------------------------------ | ---------------------------------- |
| **SLI Value**                  | `select_slo_health`                |
| **SLO Compliance**             | `select_slo_compliance`            |
| **SLO Error Budget Remaining** | `select_slo_budget_fraction`       |
| **SLO Burn Rate**              | `select_slo_burn_rate`             |

### Alias patterns for SLO queries

The **Alias By** field helps you control the format of legend keys for SLO queries.

| Alias pattern  | Description                   | Example result      |
| -------------- | ----------------------------- | ------------------- |
| `{{project}}`  | Returns the GCP project name. | `myProject`         |
| `{{service}}`  | Returns the service name.     | `myService`         |
| `{{slo}}`      | Returns the SLO.              | `latency-slo`       |
| `{{selector}}` | Returns the selector.         | `select_slo_health` |

### Alignment period and group-by time for SLO queries

SLO queries use the same alignment period functionality as [metric queries](#define-the-alignment-period).

## Query with PromQL

The PromQL query type allows you to query Google Cloud Monitoring metrics using Prometheus Query Language (PromQL) syntax. This is useful if you're familiar with PromQL from Prometheus or Grafana Mimir and want to use the same query syntax with Google Cloud Monitoring data.

For more information about PromQL support in Google Cloud Monitoring, refer to the [Google Cloud documentation on PromQL](https://cloud.google.com/monitoring/promql).

### Create a PromQL query

To create a PromQL query:

1. Select **PromQL** in the **Query type** dropdown.
1. Select a project from the **Project** dropdown.
1. Enter your PromQL query in the text area.

### Configure PromQL options

The following options are available for PromQL queries:

| Setting      | Description                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Min step** | Defines the lower bounds on the interval between data points. For example, set this to `1h` to hint that measurements are taken hourly. Supports the `$__interval` and `$__rate_interval` macros. |

### PromQL query examples

The following examples show common PromQL query patterns for Google Cloud Monitoring:

**Query CPU utilization for Compute Engine instances:**

```promql
compute_googleapis_com:instance_cpu_utilization
```

**Filter by label:**

```promql
compute_googleapis_com:instance_cpu_utilization{instance_name="my-instance"}
```

**Calculate the rate of a counter metric:**

```promql
rate(logging_googleapis_com:log_entry_count[5m])
```


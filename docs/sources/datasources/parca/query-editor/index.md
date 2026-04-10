---
description: Use the Parca query editor to query and visualize continuous profiling
  data in Grafana.
keywords:
  - grafana
  - parca
  - query editor
  - profiling
  - flame graph
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: Parca query editor
weight: 300
review_date: 2026-04-10
---

# Parca query editor

This page explains how to use the Parca query editor to query and visualize continuous profiling data.

The query editor gives you access to a profile type selector, a label selector with autocomplete, and collapsible options for controlling query behavior.

## Before you begin

Before using the query editor, ensure you have:

- [Configured the Parca data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/configure/).
- Verified the connection using **Save & test**.

## Profile type selector

Select a profile type from the cascading drop-down menu. Profile types are grouped by name, with a second level showing the sample type.

You must select a profile type for the query to be valid. Grafana doesn't return any data if the profile type isn't selected when a query runs.

## Label selector

Use the label selector to filter profiles by labels. The label selector provides an editor with autocomplete for both label names and label values.

Parca uses a syntax similar to Prometheus for label filtering. Wrap label matchers in curly braces using `{key="value"}` format. For example:

```text
{job="default/my-service"}
```

You can combine multiple label matchers separated by commas:

```text
{job="default/my-service", instance="10.0.0.1:7070"}
```

The label selector can be left empty to query all profiles of the selected type without filtering.

Refer to the [Parca documentation](https://www.parca.dev/docs) for available operators and syntax.

## Query types

Expand the **Options** section to select a query type. The query type controls what data is returned and how it's visualized.

| Query type  | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| **Profile** | Returns a merged profile visualized as a flame graph.            |
| **Metrics** | Returns aggregated metric data visualized as a time series.      |
| **Both**    | Returns both profile and metric data. Only available in Explore. |

{{< admonition type="note" >}}
The **Both** option is only available in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/). In dashboard panels, you can select either **Profile** or **Metrics** because panels support only one visualization type.
{{< /admonition >}}

## Use template variables in queries

The label selector field supports Grafana template variables. You can use variables like `$job` or `$instance` in the label selector to create dynamic, reusable dashboards.

For more information about supported variable types, examples, and limitations, refer to [Parca template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/template-variables/).

## Profile query results

Profiles are visualized as a flame graph. Refer to the [flame graph documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/) to learn about the visualization and its features.

Parca returns profiles aggregated over the selected time range. The absolute values in the flame graph grow as the time range gets bigger while keeping the relative values meaningful. You can zoom in on the time range to get a higher granularity profile, down to the point of a single Parca scrape interval.

## Metrics query results

Metrics results represent the aggregated value over time of the selected profile type.

Parca returns ungrouped data with a separate time series for each label combination. This allows you to quickly identify spikes in the value of scraped profiles and zoom in to a particular time range for further investigation.

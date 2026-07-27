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

This document explains how to use the Parca query editor to query and visualize continuous profiling data.

The query editor gives you access to a profile type selector, a label selector with autocomplete, and collapsible options for controlling query behavior.

## Before you begin

Before using the query editor, ensure you have:

- [Configured the Parca data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/configure/).
- Verified the connection using **Save & test**.

## Access the query editor

To access the query editor:

1. Sign in to Grafana.
1. Select **Explore** from the left-side menu.
1. Select your Parca data source from the data source drop-down.

You can also access the query editor from a dashboard panel by selecting the Parca data source when editing a panel.

## Profile type selector

Select a profile type from the cascading drop-down menu. Profile types are grouped by name at the first level, with a second level showing the sample type.

For example, a `process_cpu` profile might show sample types like `cpu` or `samples`.

You must select a profile type for the query to be valid. Grafana doesn't return any data if the profile type isn't selected when a query runs.

### Profile type ID format

Each profile type has an ID in the format `name:sampleType:sampleUnit:periodType:periodUnit`. Delta profile types include an additional `:delta` suffix. You don't need to construct these IDs manually -- the cascading drop-down handles selection for you.

Examples of profile type IDs:

| Profile type ID                                     | Description                                 |
| --------------------------------------------------- | ------------------------------------------- |
| `process_cpu:samples:count:cpu:nanoseconds`         | CPU profile measuring sample counts.        |
| `memory:alloc_objects:count:space:bytes`            | Memory profile measuring allocated objects. |
| `process_cpu:cpu:nanoseconds:cpu:nanoseconds:delta` | Delta CPU profile measuring nanoseconds.    |

## Label selector

Use the label selector to filter profiles by labels. The editor provides autocomplete for both label names and label values.

### Syntax

Parca uses a syntax similar to Prometheus for label filtering. Wrap label matchers in curly braces using the `{key="value"}` format.

The following operators are supported:

| Operator | Description                       | Example                 |
| -------- | --------------------------------- | ----------------------- |
| `=`      | Equals                            | `{job="my-service"}`    |
| `!=`     | Not equals                        | `{job!="test-service"}` |
| `=~`     | Regular expression match          | `{job=~"prod-.*"}`      |
| `!~`     | Negative regular expression match | `{job!~"test-.*"}`      |

You can combine multiple label matchers separated by commas:

```text
{job="my-service", instance=~"10.0.0.*"}
```

The label selector can be left empty to query all profiles of the selected type without filtering.

Refer to the [Parca documentation](https://www.parca.dev/docs) for additional syntax details.

### Autocomplete

The label selector provides autocomplete suggestions as you type. Autocomplete is triggered by the following characters: `{`, `,`, `[`, `(`, `=`, `~`, space, and `"`.

- **Label names:** Suggested when you start typing inside curly braces or after a comma.
- **Label values:** Suggested after typing a label name followed by `=` or `="`.

### Keyboard shortcuts

| Shortcut          | Action                            |
| ----------------- | --------------------------------- |
| **Shift + Enter** | Run the query with current input. |

## Query types

Expand the **Options** section to select a query type. The query type controls what data is returned and how it's visualized.

| Query type  | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| **Metric**  | Returns aggregated metric data visualized as a time series.      |
| **Profile** | Returns a merged profile visualized as a flame graph.            |
| **Both**    | Returns both metric and profile data. Only available in Explore. |

{{< admonition type="note" >}}
The **Both** option is only available in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/). In dashboard panels, you can select either **Metric** or **Profile** because panels support only one visualization type. If a query set to **Both** is moved from Explore to a dashboard, Grafana automatically changes it to **Profile**.
{{< /admonition >}}

## Use template variables in queries

The label selector field supports Grafana template variables. You can use variables like `$job` or `$instance` in the label selector to create dynamic, reusable dashboards.

For more information about supported variable types, examples, and limitations, refer to [Parca template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/template-variables/).

## Query examples

The following examples show common profiling queries.

### Query CPU profiles for a specific service

1. Select **process_cpu** > **cpu** from the profile type drop-down.
1. Enter a label selector to filter by service:

   ```text
   {job="my-service"}
   ```

1. Set query type to **Profile** to view a flame graph, or **Metric** to view CPU usage over time.

### Compare profiles across instances

1. Select a profile type such as **process_cpu** > **samples**.
1. Filter to a specific service and instance:

   ```text
   {job="my-service", instance="10.0.0.1:7070"}
   ```

1. Add a second query (click **+ Add query**) with a different instance:

   ```text
   {job="my-service", instance="10.0.0.2:7070"}
   ```

1. Set both queries to **Metric** to compare time-series data across instances.

### Find memory allocation hot spots

1. Select **memory** > **alloc_objects** from the profile type drop-down.
1. Optionally filter by service:

   ```text
   {job="api-gateway"}
   ```

1. Set query type to **Profile** to view a flame graph showing which functions allocate the most objects.
1. Adjust the time range to narrow down to a specific incident window.

## Profile query results

Profiles are visualized as a flame graph. Refer to the [flame graph documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/) to learn about the visualization and its features.

Parca returns profiles aggregated over the selected time range. The absolute values in the flame graph grow as the time range gets bigger while keeping the relative values meaningful. You can zoom in on the time range to get a higher granularity profile, down to the point of a single Parca scrape interval.

The flame graph displays the following columns:

| Column    | Description                                     |
| --------- | ----------------------------------------------- |
| **level** | The depth of the function in the call stack.    |
| **value** | The cumulative value including child functions. |
| **self**  | The value attributable to this function only.   |
| **label** | The function name or symbol.                    |

Units are automatically mapped from Parca to Grafana formats: `nanoseconds` displays as `ns` and `count` displays as a short number.

## Metrics query results

Metrics results represent the aggregated value over time of the selected profile type.

Parca returns a separate time series for each label combination, allowing you to quickly identify spikes in the value of scraped profiles and zoom in to a particular time range for further investigation.

The time-series value field is named after the sample type from the profile type ID. For example, a query using `process_cpu:samples:count:cpu:nanoseconds` produces a value field named `samples`.

---
aliases:
  - ../features/datasources/parca/
description: Continuous profiling for analysis of CPU and memory usage, down to the
  line number and throughout time. Saving infrastructure cost, improving performance,
  and increasing reliability.
keywords:
  - parca
  - guide
  - profiling
title: Parca
weight: 1110
---

# Parca data source

Grafana ships with built-in support for Parca, a continuous profiling OSS database for analysis of CPU and memory usage, down to the line number and throughout time. Add it as a data source, and you are ready to query your profiles in [Explore]({{< relref "../explore" >}}).

## Configure the Parca data source

To access Parca settings, click the **Configuration** (gear) icon, then click **Data Sources** > **Parca**.

| Name         | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `Name`       | A name to specify the data source in panels, queries, and Explore. |
| `Default`    | The default data source will be pre-selected for new panels.       |
| `URL`        | The URL of the Parca instance, e.g., `http://localhost:4100`       |
| `Basic Auth` | Enable basic authentication to the Parca data source.              |
| `User`       | User name for basic authentication.                                |
| `Password`   | Password for basic authentication.                                 |

## Querying

### Query Editor

![Query editor](/static/img/docs/parca/query-editor.png 'Query editor')

Query editor gives you access to a profile type selector, a label selector, and collapsible options.

![Profile selector](/static/img/docs/parca/select-profile.png 'Profile selector')

Select a profile type from the drop-down menu. While the label selector can be left empty to query all profiles without filtering by labels, the profile type must be selected for the query to be valid. Grafana does not show any data if the profile type isn’t selected when a query is run.

![Labels selector](/static/img/docs/parca/labels-selector.png 'Labels selector')

Use the labels selector input to filter by labels. Parca uses similar syntax to Prometheus to filter labels. Refer to [Parca documentation](https://www.parca.dev/docs) for available operators and syntax.

![Options section](/static/img/docs/parca/options-section.png 'Options section')

Select a query type to return the profile data which can be shown in the [Flame Graph]({{< relref "../panels-visualizations/visualizations/flame-graph" >}}), metric data visualized in a graph, or both. You can only select both options in a dashboard, because panels allow only one visualization.

### Profiles query results

Profiles can be visualized in a flame graph. See the [Flame Graph documentation]({{< relref "../panels-visualizations/visualizations/flame-graph" >}}) to learn about the visualization and its features.

![Flame graph](/static/img/docs/parca/flame-graph.png 'Flame graph')

Parca returns profiles aggregated over a selected time range, and the absolute values in the flame graph grow as the time range gets bigger while keeping the relative values meaningful. You can zoom in on the time range to get a higher granularity profile up to the point of a single Parca scrape interval.

### Metrics query results

Metrics results represent the aggregated value, over time, of the selected profile type. Parca returns ungrouped data with a series for each label combination.

![Metrics graph](/static/img/docs/parca/metric-graph.png 'Metrics graph')

This allows you to quickly see any spikes in the value of the scraped profiles and zoom in to a particular time range.

## Provision the Parca data source

You can modify the Grafana configuration files to provision the Parca data source. To learn more, and to view the available provisioning settings, see [provisioning documentation]({{< relref "../administration/provisioning/#datasources" >}}).

Here is an example config:

```yaml
apiVersion: 1

datasources:
  - name: Parca
    type: parca
    url: http://localhost:3100
```

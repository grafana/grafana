---
description: Use the query editor to explore your Pyroscope data.
keywords:
  - query
  - profiling
  - pyroscope
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Query profile data
menuTitle: Query profile data
weight: 300
refs:
  configure-tempo-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/
    - pattern: /docs/grafana-cloud/
      destination: docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source/
  flame-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
---

# Query profile data

The Pyroscope data source query editor gives you access to a profile type selector, a label selector, and collapsible options.

![Query editor](/media/docs/pyroscope/query-editor/query-editor.png 'Query editor')

To access the query editor:

1. Sign into Grafana or Grafana Cloud.
1. Select your Pyroscope data source.
1. From the menu, choose **Explore**.

1. Select a profile type from the drop-down menu.

   {{< figure src="/media/docs/pyroscope/query-editor/select-profile.png" class="docs-image--no-shadow" max-width="450px" caption="Profile selector" >}}

1. Use the labels selector input to filter by labels. Pyroscope uses similar syntax to Prometheus to filter labels.
   Refer to [Pyroscope documentation](https://grafana.com/docs/pyroscope/latest/) for available operators and syntax.

   While the label selector can be left empty to query all profiles without filtering by labels, the profile type or app must be selected for the query to be valid.

   Grafana doesn't show any data if the profile type or app isn’t selected when a query runs.

   ![Labels selector](/media/docs/pyroscope/query-editor/labels-selector.png 'Labels selector')

1. Expand the **Options** section to view **Query Type** and **Group by**.
   ![Options section](/media/docs/pyroscope/query-editor/options-section.png 'Options section')

1. Select a query type to return the profile data. Data is shown in the [Flame Graph](ref:flame-graph), metric data visualized in a graph, or both. You can only select both options in Explore. The panels used on dashboards allow only one visualization.

Using **Group by**, you can group metric data by a specified label.
Without any **Group by** label, metric data aggregates over all the labels into single time series.
You can use multiple labels to group by. Group by only effects the metric data and doesn't change the profile data results.

## Profiles query results

Profiles can be visualized in a flame graph.
Refer to the [Flame Graph documentation](ref:flame-graph) to learn about the visualization and its features.

![Flame graph](/media/docs/pyroscope/query-editor/flame-graph.png 'Flame graph')

Pyroscope returns profiles aggregated over a selected time range.
The absolute values in the flame graph grow as the time range gets bigger while keeping the relative values meaningful.
You can zoom in on the time range to get a higher granularity profile up to the point of a single scrape interval.

## Metrics query results

Metrics results represent the aggregated sum value over time of the selected profile type.

![Metrics graph](/media/docs/pyroscope/query-editor/metric-graph.png 'Metrics graph')

This allows you to quickly see any spikes in the value of the scraped profiles and zoom in to a particular time range.

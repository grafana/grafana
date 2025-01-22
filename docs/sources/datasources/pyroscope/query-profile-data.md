---
description: Explore your profiling data using Explore Profiles or the Pyroscope query editor.
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
weight: 400
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
  explore-profiles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/profiles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/simplified-exploration/profiles/
  explore-profile-install:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/profiles/access/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/simplified-exploration/profiles/access/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
  flame-graph-panel:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/flame-graph/
---

https://grafana.com/docs/grafana-cloud/visualizations/panels-visualizations/visualizations/flame-graph/

# Query profile data

You can query your profile data using the open source Grafana Explore Profiles app or the built-in Grafana Pyroscope data source query editor.

- Explore Profiles provides a queryless experience for inspecting your profiling data with opinionated workflows to assist your investigation.
- Data source query editor provides complete control over your data exploration and is recommended for experienced users.

In addition, you can embed flame graph panels in Grafana dashboards.
Refer to the [Flame graph panel](ref:flame-graph-panel) documentation for details.

## Explore Profiles

[Explore Profiles](ref:explore-profiles) is a native Grafana application designed to integrate seamlessly with Pyroscope, the open source continuous profiling platform, providing a smooth, queryless experience for browsing and analyzing profiling data.

You can use Explore Profiles in Grafana Cloud or in your own Grafana instance.
For more information, refer to [Access or install Explore Profiles](ref:explore-profiles-install).

![Explore Profiles home screen](/media/docs/explore-profiles/explore-profiles-homescreen-v0.1.17.png)

### Use cases

There are several different modes for viewing, analyzing, and comparing profiling data.

The main use cases are the following:

- Proactive: Cutting costs, addressing latency issues, or optimizing memory usage for applications
- Reactive: Resolving incidents with line-level accuracy or debugging active latency/memory issues

Explore Profiles provides an intuitive interface to specifically support proactivee and reactive use cases.
You get a holistic view of all of your services and how they're functioning, but also the ability to drill down for more targeted root cause analysis.

Explore Profiles offers a convenient platform to analyze profiles and get insights that are impossible to get from using other traditional signals like logs, metrics, or tracing.

{{< youtube id="x9aPw_CbIQc" >}}

{{< docs/play title="the Grafana Play site" url="https://play.grafana.org/a/grafana-pyroscope-app/profiles-explorer" >}}

## Pyroscope query editor

The Pyroscope data source query editor gives you access to a profile type selector, a label selector, and collapsible options.

Like Explore Profiles, the query editor also provides a flame graph to visualize data.

![Query editor](/media/docs/pyroscope/query-editor/query-editor.png 'Query editor')

To access the query editor:

1. Sign into Grafana or Grafana Cloud.
1. Select your Pyroscope data source.
1. From the menu, choose **Explore**.

1. Select a profile type from the drop-down menu.

   {{< figure src="/media/docs/pyroscope/query-editor/select-profile.png" class="docs-image--no-shadow" max-width="450px" caption="Profile selector" >}}

1. Use the labels selector input to filter by labels. Pyroscope uses similar syntax to Prometheus to filter labels.
   Refer to [Pyroscope documentation](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/) for available operators and syntax.

   While the label selector can be left empty to query all profiles without filtering by labels, you must select a profile type or app for the query to be valid.

   Grafana doesn't show any data if the profile type or app isn’t selected when a query runs.

   ![Labels selector](/media/docs/pyroscope/query-editor/labels-selector.png 'Labels selector')

1. Expand the **Options** section to view **Query Type** and **Group by**.
   ![Options section](/media/docs/pyroscope/query-editor/options-section.png 'Options section')

1. Select a query type to return the profile data. Data is shown in the [Flame Graph](ref:flame-graph), metric data visualized in a graph, or both. You can only select both options in Explore. The panels used on dashboards allow only one visualization.

Using **Group by**, you can group metric data by a specified label.
Without any **Group by** label, metric data aggregates over all the labels into single time series.
You can use multiple labels to group by. Group by only effects the metric data and doesn't change the profile data results.

In conjunction with **Group by**, you can set a positive number in the **Limit** input to limit the maximum number of time series returned by the data source. The series returned are always ordered by descending value for the total aggregated data over the time period.

### Profiles query results

Profiles can be visualized in a flame graph.
Refer to the [Flame Graph documentation](ref:flame-graph) to learn about the visualization and its features.

![Flame graph](/media/docs/pyroscope/query-editor/flame-graph.png 'Flame graph')

Pyroscope returns profiles aggregated over a selected time range.
The absolute values in the flame graph grow as the time range gets bigger while keeping the relative values meaningful.
You can zoom in on the time range to get a higher granularity profile up to the point of a single scrape interval.

### Metrics query results

Metrics results represent the aggregated sum value over time of the selected profile type.

![Metrics graph](/media/docs/pyroscope/query-editor/metric-graph.png 'Metrics graph')

This allows you to quickly see any spikes in the value of the scraped profiles and zoom in to a particular time range.

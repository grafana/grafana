---
aliases:
  - ../features/datasources/phlare/
  - ../features/datasources/grafana-pyroscope/
description: Horizontally-scalable, highly-available, multi-tenant continuous profiling
  aggregation system. OSS profiling solution from Grafana Labs.
keywords:
  - grafana
  - phlare
  - guide
  - profiling
  - pyroscope
title: Grafana Pyroscope
weight: 1150
---

# Grafana Pyroscope data source

Formerly Phlare data source, it supports both Phlare and Pyroscope, a horizontally scalable, highly-available, multi-tenant, OSS, continuous profiling aggregation systems. Add it as a data source, and you are ready to query your profiles in [Explore]({{< relref "../explore" >}}).

## Configure the Grafana Pyroscope data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Grafana Pyroscope` in the search bar.
1. Click **Grafana Pyroscope**.

   The **Settings** tab of the data source is displayed.

1. Set the data source's basic configuration options:

   | Name           | Description                                                                                                                                                                                                                                                                                                              |
   | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `Name`         | A name to specify the data source in panels, queries, and Explore.                                                                                                                                                                                                                                                       |
   | `Default`      | The default data source will be pre-selected for new panels.                                                                                                                                                                                                                                                             |
   | `URL`          | The URL of the Grafana Pyroscope or Phlare instance, e.g., `http://localhost:4100`                                                                                                                                                                                                                                       |
   | `Basic Auth`   | Enable basic authentication to the data source.                                                                                                                                                                                                                                                                          |
   | `User`         | User name for basic authentication.                                                                                                                                                                                                                                                                                      |
   | `Password`     | Password for basic authentication.                                                                                                                                                                                                                                                                                       |
   | `Minimal step` | Used for queries returning timeseries data. Phlare backend, similar to Prometheus, scrapes profiles at certain intervals. To prevent querying at smaller interval use Minimal step same or higher than your Phlare scrape interval. For Pyroscope backend this prevents returning too many data points to the front end. |
   | `Backend type` | Select a backend type between Phlare and Pyroscope. It is autodetected if not set but once set you have to change it manually.                                                                                                                                                                                           |

## Querying

### Query Editor

![Query editor](/static/img/docs/phlare/query-editor.png 'Query editor')

Query editor gives you access to a profile type selector, a label selector, and collapsible options.

![Profile or App selector](/static/img/docs/phlare/select-profile.png 'Profile or App selector')

Select a profile type or app from the drop-down menu. While the label selector can be left empty to query all profiles without filtering by labels, the profile type or app must be selected for the query to be valid. Grafana does not show any data if the profile type or app isn’t selected when a query is run.

![Labels selector](/static/img/docs/phlare/labels-selector.png 'Labels selector')

Use the labels selector input to filter by labels. Phlare and Pyroscope uses similar syntax to Prometheus to filter labels. Refer to [Phlare documentation](https://grafana.com/docs/phlare/latest/) for available operators and syntax.

![Options section](/static/img/docs/phlare/options-section.png 'Options section')

Options section contains a switch for Query Type and Group by.

Select a query type to return the profile data which can be shown in the [Flame Graph]({{< relref "../panels-visualizations/visualizations/flame-graph" >}}), metric data visualized in a graph, or both. You can only select both options in a dashboard, because panels allow only one visualization.

Group by allows you to group metric data by a specified label. Without any Group by label, metric data is aggregated over all the labels into single time series. You can use multiple labels to group by. Group by has only an effect on the metric data and does not change the profile data results.

### Profiles query results

Profiles can be visualized in a flame graph. See the [Flame Graph documentation]({{< relref "../panels-visualizations/visualizations/flame-graph" >}}) to learn about the visualization and its features.

![Flame graph](/static/img/docs/phlare/flame-graph.png 'Flame graph')

Phlare and Pyroscope returns profiles aggregated over a selected time range, and the absolute values in the flame graph grow as the time range gets bigger while keeping the relative values meaningful. You can zoom in on the time range to get a higher granularity profile up to the point of a single scrape interval.

### Metrics query results

Metrics results represent the aggregated sum value over time of the selected profile type.

![Metrics graph](/static/img/docs/phlare/metric-graph.png 'Metrics graph')

This allows you to quickly see any spikes in the value of the scraped profiles and zoom in to a particular time range.

## Provision the Grafana Pyroscope data source

You can modify the Grafana configuration files to provision the Grafana Pyroscope data source. To learn more, and to view the available provisioning settings, see [provisioning documentation]({{< relref "../administration/provisioning/#datasources" >}}).

Here is an example config:

```yaml
apiVersion: 1

datasources:
  - name: Grafana Pyroscope
    type: phlare
    url: http://localhost:4100
    jsonData:
      minStep: '15s'
      backendType: 'pyroscope'
```

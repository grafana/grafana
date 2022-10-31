---
aliases:
- /docs/grafana/latest/datasources/phlare/
- /docs/grafana/latest/features/datasources/phlare/
  description: Horizontally-scalable, highly-available, multi-tenant continuous profiling aggregation system. OSS profiling solution from Grafana Labs.
  keywords:
- grafana
- phlare
- guide
- profiling
  title: Phlare data source
  weight: 1150
---

# Phlare data source

> **Note:** This feature is behind the `flameGraph` feature toggle.
> You can enable feature toggles through configuration file or environment variables. See configuration [docs]({{< relref "../setup-grafana/configure-grafana/#feature_toggles" >}}) for details.
> Grafana Cloud users can access this feature by [opening a support ticket in the Cloud Portal](https://grafana.com/profile/org#support).

Grafana ships with built-in support for Phlare, a horizontally scalable, highly-available, multi-tenant, OSS, continuous profiling aggregation system from Grafana Labs. Add it as a data source, and you are ready to query your profiles in [Explore]({{< relref "../explore" >}}).

## Configure the Phlare data source

To access Phlare settings, click the **Configuration** (gear) icon, then click **Data Sources** > **Phlare**.

| Name           | Description                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Name`         | A name to specify the data source in panels, queries, and Explore.                                                                                                             |
| `Default`      | The default data source will be pre-selected for new panels.                                                                                                                   |
| `URL`          | The URL of the Tempo instance, e.g., `http://localhost:4100`                                                                                                                   |
| `Basic Auth`   | Enable basic authentication to the Tempo data source.                                                                                                                          |
| `User`         | User name for basic authentication.                                                                                                                                            |
| `Password`     | Password for basic authentication.                                                                                                                                             |
| `Minimal step` | Similar to Prometheus, Phlare scrapes profiles at certain intervals. To prevent querying at smaller interval use Minimal step same or higher than your Phlare scrape interval. |

## Querying

### Query Editor

TODO: image

Query editor gives you access to a profile type selector, a label selector, and collapsible options.

TODO: image

Select a profile type from the drop-down menu. While the label selector can be left empty to query all profiles without filtering by labels, the profile type must to be selected for the query to be valid. Grafana does not show any data if the profile type isn’t selected when a query is run.

TODO: image

Use the labels selector input to filter by labels. Parca uses similar syntax to Prometheus to filter labels. Refer to Parca documentation (TODO link) for available operators and syntax.

TODO: image

Options section contains a switch for Query Type and Group by.

Select a query type to return the profile data which can be shown in a flame graph (TODO link), metric data visualized in a graph, or both. You can only select both options in a dashboard, because panels allow only one visualization.

Group by allows you to group metric data by a specified label. Without any Group by label, metric data is aggregated over all the labels into single time series. You can use multiple labels to group by. Group by has only an effect on the metric data and does not change the profile data results.

### Profiles query results

Profiles can be visualized in a flame graph. See the flame graphs documentation (TODO link) to learn about the visualization and its features.

TODO: image

Phlare returns profiles aggregated over a selected time range, and the absolute values in the flame graph grow as the time range gets bigger while keeping the relative values meaningful. You can zoom in on the time range to get a higher granularity profile up to the point of a single Phlare scrape interval.

### Metrics query results

Metrics results represent the aggregated sum value over time of the selected profile type.

TODO: image

This allows you to quickly see any spikes in the value of the scraped profiles and zoom in to a particular time range.

## Provision the Phlare data source

You can modify the Grafana configuration files to provision the Phlare data source. To learn more, and to view the available provisioning settings, see (TODO link).

Here is an example config:

```yaml
apiVersion: 1

datasources:
  - name: Phlare
    type: phlare
    url: http://localhost:4100
    jsonData:
      minStep: '15s'
```

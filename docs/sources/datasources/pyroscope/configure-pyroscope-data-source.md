---
description: Configure your Pyroscope data source for Grafana.
keywords:
  - configure
  - profiling
  - pyroscope
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure the Grafana Pyroscope data source
menuTitle: Configure Pyroscope
weight: 200
---

# Configure the Grafana Pyroscope data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Grafana Pyroscope` in the search bar.
1. Click **Grafana Pyroscope** to display the **Settings** tab of the data source.

1. Set the data source's basic configuration options:

   | Name           | Description                                                                                                                                                                                                                                                                                                  |
   | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `Name`         | A name to specify the data source in panels, queries, and Explore.                                                                                                                                                                                                                                           |
   | `Default`      | The default data source will be pre-selected for new panels.                                                                                                                                                                                                                                                 |
   | `URL`          | The URL of the Grafana Pyroscope instance, for example, `http://localhost:4100`.                                                                                                                                                                                                                             |
   | `Basic Auth`   | Enable basic authentication to the data source.                                                                                                                                                                                                                                                              |
   | `User`         | User name for basic authentication.                                                                                                                                                                                                                                                                          |
   | `Password`     | Password for basic authentication.                                                                                                                                                                                                                                                                           |
   | `Minimal step` | Used for queries returning timeseries data. The Pyroscope backend, similar to Prometheus, scrapes profiles at certain intervals. To prevent querying at smaller interval, use Minimal step same or higher than your Pyroscope scrape interval. This prevents returning too many data points to the frontend. |

{{% docs/reference %}}
[explore]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/explore"
[explore]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/explore"

[flame-graph]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/flame-graph"
[flame-graph]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/flame-graph"

[provisioning-data-sources]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning#datasources"
[provisioning-data-sources]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning#datasources"

[configure-tempo-data-source]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/tempo/configure-tempo-data-source"
[configure-tempo-data-source]: "/docs/grafana-cloud/ -> docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source"
{{% /docs/reference %}}

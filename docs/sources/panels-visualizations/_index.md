---
aliases:
  - dashboards/configure-panels-visualizations/
  - features/panels/panels/
  - panels/
keywords:
  - grafana
  - configure
  - panels
  - visualizations
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Panels and visualizations
title: Panels and visualizations
description: Learn about and configure panels and visualizations
weight: 80
---

# Panels and visualizations

The _panel_ is the basic visualization building block in Grafana.
Each panel has a query editor specific to the data source selected in the panel.
The query editor allows you to build a query that returns the data you want to visualize.

There are a wide variety of styling and formatting options for each panel.
Panels can be dragged, dropped, and resized to rearrange them on the dashboard.

Before you add a panel, ensure that you have configured a data source.

- For details about using data sources, refer to [Data sources][].

- For more information about managing data sources as an administrator, refer to [Data source management][].

  {{% admonition type="note" %}}
  [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/) is only available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/).
  {{% /admonition %}}

This section includes the following sub topics:

{{< section >}}

{{% docs/reference %}}
[Data source management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"
[Data source management]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"

[Data sources]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources"
[Data sources]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources"
{{% /docs/reference %}}

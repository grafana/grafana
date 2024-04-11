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
hero:
  title: Panels and visualizations
  level: 1
  width: 110
  height: 110
  description: >-
    Easily collect, correlate, and visualize data so you can make informed decisions in real time.
cards:
  title_class: pt-0 lh-1
  items:
    - title: Visualizations
      href: /docs/grafana/latest/panels-visualizations/visualizations/
      description:
      height: 24
    - title: Panel overview
      href: /docs/grafana/latest/panels-visualizations/panel-editor-overview/
      description: Learn about the features of the panel.
      height: 24
    - title: Panel editor
      href: /docs/grafana/latest/panels-visualizations/panel-editor-overview/
      description: Learn about the features of the panel editor.
      height: 24
    - title: Configure standard options
      href: /docs/grafana/latest/panels-visualizations/configure-standard-options/
      description: Configure standard options like units, min, max, and colors.
      height: 24
    - title: Query and transform data
      href: /docs/grafana/latest/panels-visualizations/query-transform-data/
      description:
      height: 24
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

Panels are the basic building block in Grafana, composed of a [query][] and a [visualization][]&mdash;a graphical representation of query results. Within panels, you can apply [transformations][], which process the result set of a query before it’s passed on for visualization.

Panels offer a great deal of flexibility; they can be moved and resized within a dashboard, saved as reusable library panels, used as a data source, and include links to other data or dashboards. There are also a wide variety of styling and formatting options available for panels.

Grafana’s growing suite of visualizations, ranging from time series graphs to heatmaps to cutting-edge 3D charts, help you decode complex datasets.

## Explore

{{< card-grid key="cards" type="simple" >}}

<!-- Some of the following content needs to be moved to be added to the planned Panel overview page and that page needs to be included in the tiles.


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

{{< section >}} -->

{{% docs/reference %}}
[Data source management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"
[Data source management]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"

[Data sources]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/datasources"
[Data sources]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA_VERSION>/datasources"

[transformations]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data"
[transformations]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data"

[query]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data"
[query]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data"

[visualization]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations"
[visualization]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations"
{{% /docs/reference %}}

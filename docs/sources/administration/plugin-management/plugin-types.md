---
title: Types of plugins
description: Learn about the types of plugins available in Grafana.
labels:
  products:
    - enterprise
    - oss
    - cloud
keywords:
  - grafana
  - plugins
  - plugin
  - navigation
  - customize
  - configuration
  - grafana.ini
  - sandbox
  - frontend
weight: 100
---

# Types of plugins

Grafana supports three types of plugins:

- [Panels](/grafana/plugins/panel-plugins) - These plugins make it easy to create and add any kind of panel, to show your data, or improve your favorite dashboards.
- [Data sources](/grafana/plugins/data-source-plugins) - These plugins allow you to pull data from various data sources such as databases, APIs, log files, and so on, and display it in the form of graphs, charts, and dashboards in Grafana.
- [Apps](/grafana/plugins/app-plugins) - These plugins enable the bundling of data sources, panels, dashboards, and Grafana pages into a cohesive experience.

## Panel plugins

Add new visualizations to your dashboard with panel plugins, such as the [Clock](/grafana/plugins/grafana-clock-panel), [Mosaic](/grafana/plugins/boazreicher-mosaicplot-panel) and [Variable](/grafana/plugins/volkovlabs-variable-panel) panels.

Use panel plugins when you want to:

- Visualize data returned by data source queries.
- Navigate between dashboards.
- Control external systems, such as smart home devices.

## Data source plugins

Data source plugins add support for new databases, such as [Google BigQuery](/grafana/plugins/grafana-bigquery-datasource).

Data source plugins communicate with external sources of data and return the data in a format that Grafana understands. By adding a data source plugin, you can immediately use the data in any of your existing dashboards.

Use data source plugins when you want to query data from external or third-party systems.

## App plugins

Applications, or app plugins, bundle data sources and panels to provide a cohesive experience, such as the [Zabbix](/grafana/plugins/alexanderzobnin-zabbix-app) app.

Apps can also add custom pages for things like control panels.

Use app plugins when you want an out-of-the-box monitoring experience.

### Managing access for app plugins

Customize access to app plugins with [RBAC](/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-for-app-plugins/).

By default, the Viewer, Editor and Admin roles have access to all app plugins that their Organization role allows them to access. Access is granted by the `fixed:plugins.app:reader` role.

{{< admonition type="note" >}}
To prevent users from seeing an app plugin, refer to [these permissions scenarios](/docs/grafana/<GRAFANA_VERSION>/roles-and-permissions/access-control/plan-rbac-rollout-strategy/#prevent-viewers-from-accessing-an-app-plugin).
{{< /admonition >}}

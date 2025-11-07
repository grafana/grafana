---
aliases:
  - data-sources/
  - overview/
  - ./features/datasources/
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Concepts   
title: Data sources, plugins and integrations
weight: 70
refs:
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  plugin-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/
    - pattern: /docs/grafana-cloud
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/
---

# Data sources, plugins, and integrations

When working with Grafana, you'll encounter three key concepts: data sources, plugins and integrations.  Each one is essential in building effective monitoring solutions, but they serve distinct purposes, and are often confused with one another. This document clarifies the meaning of each concept and what each one does, when to use it, and how they work together to create observability solutions in Grafana.

## Data source

A data source is a connection to a specific database, monitoring system, service, or other external location that stores data, metrics, logs, or traces. Examples include Prometheus, InfluxDB, PostgreSQL, or CloudWatch. When you configure a data source in Grafana, you're basically telling it where to fetch data from, providing connection details, credentials, and endpoints. Data sources are the foundation for working with Grafana. Without them, Grafana has nothing to visualize. Once configured, you can query your Prometheus data source to display CPU metrics, or query CloudWatch to visualize AWS infrastructure performance

## Plugins

A plugin extends Grafana’s core functionality. Plugins can add new data source types, visualization panels, or full-featured applications that integrate with Grafana. They make Grafana modular and extensible.

Plugins come in three types:

- **Data source plugins** connect Grafana to **external data sources**. You use this type of plugin when you want to access and work with data from an external source or third party. Examples include Prometheus, MSSQL, and Databricks.

- **App plugins** allow you to bundle data sources and panel plugins within a single package. They also enable you to create custom pages within Grafana, providing a dedicated space for documentation, sign-up forms, and integration with other services via HTTP. Examples include Grafana Metrics Drilldown, Azure Cloud Native Monitoring, and Redis Application.

- **Panel plugins** control how data is visualized in Grafana dashboards. Examples of panel plugins include pie chart, candlestick, and Plotly. 

## Integrations

_Integrations are exclusive to Grafana Cloud._ An integration is a pre-packaged monitoring solution that bundles export/scrape configurations, pre-built dashboards, alert rules, and sometimes recording rules. Unlike standalone data sources, integrations handle the complete workflow: they configure how telemetry is collected and sent to Grafana Cloud's hosted databases, then provide ready-to-use dashboards and alerts. For example, a Kubernetes integration configures metric collection from your cluster, creates dashboards for monitoring, and sets up common alerts—all working together out of the box

## When to use each

Use a data source when:

- You want to connect Grafana to a specific system (for example, Prometheus or MySQL).
- You’re building custom dashboards with hand-picked metrics and visualizations.
- Your monitoring needs are unique or not covered by pre-packaged integrations.

Use a plugin when:

- You need to connect to a system Grafana doesn’t support natively.
- You want to add new functionality (visualizations, workflows, or app-style extensions).
- You have specialized or industry-specific requirements (for example, IoT).

Use an integration when:

- You’re using Grafana Cloud and want a quick, pre-built setup.
- You prefer minimal configuration with ready-to-use dashboards and alerts.
- You’re new to observability and want to learn what good monitoring looks like.

## Relationships and interactions

How data sources, plugins, and integrations work together:

- Plugins extend what Grafana can do.
- Data sources define where Grafana reads data from.
- Integrations combine telemetry collection and pre-built content to create complete monitoring solutions.

Examples: 

- Install a Prometheus data source plugin. Configure the Prometheus data source to connect to your Prometheus instance. Use the `Geomap` panel plugin to add a custom visualization showing your Kubernetes pods across world regions.

- Install the Azure Cloud Native Monitoring app plugin, which bundles the app and data source plugin types. It includes data source plugins for Azure Monitor and Log Analytics, panel plugins for visualizing Azure metrics, and a custom configuration page for managing authentication and subscriptions.

- If you’re using Grafana Cloud, add the ClickHouse integration. This integration provides pre-built dashboards and alerts to monitor ClickHouse cluster metrics and logs, enabling users to visualize and analyze their ClickHouse performance and health in real-time. 

## Common confusion points

**What's the difference between a data source and a data source plugin?**

A data source plugin is a **software component that enables Grafana to communicate** with specific types of databases or services, like Prometheus, MySQL, or InfluxDB. A data source is **an actual configured connection** to one of these databases, including the credentials, URL, and settings needed to retrieve data.

Think of it this way: You _install_ a plugin but _configure_ a data source.

**Do I need a plugin to use a data source?**

In most cases, yes. Some plugins are bundled with Grafana by default, like Prometheus or Loki, but starting with Grafana v12.4, these are being released separately. Each has its own versioning and lifecycle but remains fully compatible.

**Can I use integrations in self-hosted Grafana?** 

No, integrations are exclusive to Grafana Cloud. In self-hosted Grafana, you can replicate similar setups manually using data sources and dashboards.

**Aren't integrations just pre-built dashboards?**

No, integrations are much more than just dashboards. While dashboards are part of an integration, they’re only one piece. Integrations typically include:

- Data collection setup (for example, pre-configured agents or exporters).
- Predefined metrics and queries tailored to the technology.
- Alerting rules and notifications to help detect common issues.
- Dashboards to visualize and explore that data.

**What’s the difference between plugin types?**

A panel plugin in Grafana is an extension that allows you to add new and custom visualizations to your Grafana dashboards. While Grafana comes with several built-in panel types (like graphs, single stats, and tables), panel plugins extend this functionality by providing specialized ways to display data. 

An app plugin in Grafana is a type of plugin that provides a comprehensive, integrated, and often out-of-the-box experience within Grafana. Unlike data source plugins (which connect to external data sources) or panel plugins (which provide new visualization types), app plugins can combine various functionalities to create a more complete application-like experience. 

A data source plugin in Grafana is a software component that enables Grafana to connect to and retrieve data from various external data sources. Once the plugin is installed, you can use it to configure one or more data sources. Each data source defines the actual connection details, like the server URL, authentication method, and query options.

## Summary reference

Use the following table to compare how data sources, plugins, and integrations differ in scope, purpose, and use. It highlights where each applies within Grafana, what problems it solves, and how they work together to build complete observability solutions.

| Concept                | Where it applies                | Purpose                                                                      | What it includes                                                                                                                              | When to use it                                                                              | Example                                                                         |
| ---------------------- | ------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Data source**        | Grafana (self-hosted and Cloud) | Connects Grafana to an external system that stores metrics, logs, or traces. | Connection settings, authentication details, query configuration.                                                                             | You want to visualize data from a database, monitoring system, or API.                      | Prometheus, CloudWatch, PostgreSQL, Loki                                        |
| **Plugin**             | Grafana (self-hosted and Cloud) | Extends Grafana’s core platform with new capabilities.                       | Data source types, panel visualizations, or complete app workflows.                                                                           | You need new data source support, visualizations, or functionality not included by default. | Plotly panel, MongoDB data source, Redis Application                            |
| **App plugin**         | Grafana (self-hosted and Cloud) | Bundles multiple plugin types and adds custom pages or UI.                   | Data source + panel plugins + custom routes and integrations.                                                                                 | You want to create a dedicated app-like experience in Grafana.                              | Azure Cloud Native Monitoring, Metrics Drilldown                                |
| **Panel plugin**       | Grafana (self-hosted and Cloud) | Adds new visualization types to dashboards.                                  | Custom panels and visualization logic.                                                                                                        | You want to display data in new visual forms beyond Grafana’s built-ins.                    | Pie chart, Candlestick, Plotly, Geomap                                                  |
| **Data source plugin** | Grafana (self-hosted and Cloud) | Enables Grafana to connect to a new type of external system.                 | Driver or connector code that defines how Grafana queries that system.                                                                        | You need to access data from an unsupported or proprietary backend.                         | Databricks, MongoDB, MSSQL                                                      |
| **Integration**        | Grafana Cloud only              | Provides a pre-packaged observability solution for a specific technology.    | Telemetry configuration, dashboards, alert rules, recording rules.                                                                            | You want an out-of-the-box setup with minimal configuration.                                | Kubernetes, Redis, NGINX, AWS EC2                                               |
| **Relationship**       | —                               | How they interact                                                            | Plugins extend Grafana’s capabilities → Data sources define where data comes from → Integrations combine both to deliver a complete solution. | Use all three together for full observability.                                              | Install a data source plugin → configure a data source → enable an integration. |

For detailed documentation and how-to guides related to data sources, plugins, and integrations, refer to the following references:

**Data sources**:

- [Manage data sources](ref:data-source-management)

**Plugins**:

- [Plugin types and usage](https://grafana.com/developers/plugin-tools/key-concepts/plugin-types-usage)
- [App plugins](https://grafana.com/developers/plugin-tools/how-to-guides/app-plugins/)
- [Data source plugins](https://grafana.com/developers/plugin-tools/how-to-guides/data-source-plugins/)
- [Panel plugins](https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/)

**Integrations**:

- [Grafana integrations](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/)
- [Install and manage integrations](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/install-and-manage-integrations/)
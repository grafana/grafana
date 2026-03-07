---
aliases:
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

When working with Grafana, you'll encounter three key concepts: data sources, plugins, and integrations. Each one is essential in building effective monitoring solutions, but they serve distinct purposes, and are often confused with one another. This document clarifies the meaning of each concept and what each one does, when to use it, and how they work together to create observability solutions in Grafana.

## Data sources

A data source is a connection to a specific database, monitoring system, service, or other external location that stores data, metrics, logs, or traces. Examples include Prometheus, InfluxDB, PostgreSQL, or CloudWatch. When you configure a data source in Grafana, you're telling it where to fetch data from, providing connection details, credentials, and endpoints. Data sources are the foundation for working with Grafana. Without them, Grafana has nothing to visualize. Once configured, you can query your Prometheus data source to display CPU metrics, or query CloudWatch to visualize AWS infrastructure performance.

## Plugins

A plugin extends Grafana’s core functionality. Plugins can add new data source types, visualization panels, or full-featured applications that integrate with Grafana. They make Grafana modular and extensible.

Plugins come in three types:

- **Data source plugins** connect Grafana to **external data sources**. You use this type of plugin when you want to access and work with data from an external source or third party. Examples include Prometheus, MSSQL, and Databricks.

- **Panel plugins** control how data appears in Grafana dashboards. Examples of panel plugins include pie chart, candlestick, and traffic light. Note that in some cases, panels don't rely on a data source at all. The **Text** panel can render static or templated content without querying data. Panels can also support user-driven actions. For example, the **Button** panel can trigger workflows or external calls.

- **App plugins** allow you to bundle data sources and panel plugins within a single package. They enable you to create custom pages within Grafana that can function like dashboards, providing dedicated spaces for documentation, sign-up forms, custom UI extensions, and integration with other services via HTTP. Cloud apps built as app plugins offer out-of-the-box observability solutions, such as Azure Cloud Native Monitoring and Redis Application, that provide comprehensive monitoring capabilities compared to standalone integrations

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

- Install the Databricks data source plugin. Configure the Databricks data source and run SQL queries against your Databricks workspace. Use the `Histogram` panel to visualize distributions in your query results, such as latency buckets, job durations, or model output scores.

- Install the Redis Application app plugin. This app provides a unified experience for monitoring Redis by working with your existing Redis data source. It adds custom pages for configuration and exploration, along with prebuilt dashboards, commands, and visualizations that help you analyze performance, memory usage, and key activity.

<!-- - Install the Azure Cloud Native Monitoring app plugin, which bundles the app and data source plugin types. It includes data source plugins for Azure Monitor and Log Analytics, panel plugins for visualizing Azure metrics, and a custom configuration page for managing authentication and subscriptions. -->

- If you’re using Grafana Cloud, add the ClickHouse integration. This integration provides pre-built dashboards and alerts to monitor ClickHouse cluster metrics and logs, enabling users to visualize and analyze their ClickHouse performance and health in real-time.

## Frequently asked questions

**What's the difference between a data source and a data source plugin?**

A data source plugin is a **software component that enables Grafana to communicate** with specific types of databases or services, like Prometheus, MySQL, or InfluxDB. A data source is **an actual configured connection** to one of these databases, including the credentials, URL, and settings needed to retrieve data.

Think of it this way: You _install_ a plugin but _configure_ a data source.

**Do I need a plugin to use a data source?**

You must install the plugin before you configure or use the data source. Each data source plugin has its own versioning and lifecycle. Grafana includes built-in core data sources, which can be thought of as pre-installed plugins.

**Can I use integrations in self-hosted Grafana?**

No, integrations are exclusive to Grafana Cloud. In self-hosted Grafana, you can replicate similar setups manually using data sources and dashboards.

**Aren't integrations just pre-built dashboards?**

No, integrations are much more than just dashboards. While dashboards are part of an integration, they’re only one piece. Integrations typically include:

- Data collection setup (for example, pre-configured agents or exporters).
- Predefined metrics and queries tailored to the technology.
- Alerting rules and notifications to help detect common issues.
- Dashboards to visualize and explore that data.

**What’s the difference between plugin types?**

A data source plugin in Grafana is a software component that enables Grafana to connect to and retrieve data from various external data sources. After you install the plugin, you can use it to configure one or more data sources. Each data source defines the actual connection details, like the server URL, authentication method, and query options.

A panel plugin in Grafana is an extension that allows you to add new and custom visualizations to your Grafana dashboards. While Grafana comes with several built-in panel types (like graphs, single stats, and tables), panel plugins extend this functionality by providing specialized ways to display data.

An app plugin in Grafana is a type of plugin that provides a comprehensive, integrated, and often out-of-the-box experience within Grafana. Unlike data source plugins, which connect to external data sources, or panel plugins, which provide new visualization types, app plugins can combine various functionalities to create a more complete experience.

**How do data sources and integrations differ in how they handle data?**

Data sources query data where it already lives. They connect Grafana to an external system or database, such as Prometheus, MySQL, or Elasticsearch and fetch data on demand. You keep full control over your own data stores, schemas and retention policies.

In contrast, integrations focus on getting data into Grafana Cloud’s hosted backends. They ingest metrics, logs, and traces into systems like Mimir, Loki, or Tempo, using pre-configured agents and pipelines. Instead of querying an external database, Grafana queries its own managed storage where the integration has placed the data.

## Summary reference

Use the following table to compare how data sources, plugins, and integrations differ in scope, purpose, and use. It highlights where each applies within Grafana, what problems it solves, and how they work together to build observability solutions.

| Concept                | Where it applies       | Purpose                                              | What it includes                                            | When to use it                                          | Example                                    |
| ---------------------- | ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| **Data source**        | Self-hosted and Cloud  | Connect to external metrics, logs, or traces storage | Connection settings, auth, query config                     | Visualize data from a database or monitoring system     | Prometheus, CloudWatch, PostgreSQL         |
| **Plugin**             | Self-hosted and Cloud  | Extend Grafana with new capabilities                 | Three types: data source, panel, and app                    | Add connectivity or functionality not included by default | Plotly panel, MongoDB data source          |
| **App plugin**         | Self-hosted and Cloud  | Bundle plugins with custom pages or UI               | Data source + panel plugins + custom routes                 | Create a dedicated app-like experience                  | Azure Cloud Native Monitoring              |
| **Panel plugin**       | Self-hosted and Cloud  | Add new visualization types                          | Custom panels and visualization logic                       | Display data beyond built-in visualizations             | Pie chart, Candlestick, Geomap             |
| **Data source plugin** | Self-hosted and Cloud  | Connect to a new external system type                | Connector code for querying that system                     | Access data from an unsupported backend                 | Databricks, MongoDB, MSSQL                 |
| **Integration**        | Grafana Cloud only     | Pre-packaged observability for a specific technology | Telemetry config, dashboards, alerts, recording rules       | Get an out-of-the-box setup with minimal configuration  | Kubernetes, Redis, NGINX                   |

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

---
keywords:
  - grafana
  - documentation
  - developers
  - resources
  - data model
  - developer portal
  - developer tools
title: Developer tools
menuTitle: Developer tools
weight: 200
canonical: https://grafana.com/docs/grafana/latest/developer-resources/developer-tools/
---

# Developer tools in Grafana

Refer to the [Grafana developer portal](https://grafana.com/developers) to access the following documentation:

- [Grafana plugin development tools](https://grafana.com/developers/plugin-tools)
- [Grafana data structure](https://grafana.com/developers/dataplane/)
- [Grafana React components library](https://developers.grafana.com)
- [Grafana Scenes library](https://grafana.com/developers/scenes)

## Plugin development

You can develop your own Grafana plugin to enhance the features of Grafana, such as:

- Panel plugins to visualize data
- Data source plugins to connect to a new database or other source of data
- App plugins to provide integrated out-of-the-box experiences

Refer to [Grafana plugin tools](https://grafana.com/developers/plugin-tools) for all the information.

## Data structure in Grafana

Grafana supports a variety of different data sources, each with its own data model. To manage this, Grafana consolidates the query results from each of these data sources into one unified data structure called a **data frame**. Additionally, the **data plane** adds a property layer to the data frame with information about the data frame type and what the data frame holds.

Refer to the [Grafana data structure documentation](https://grafana.com/developers/dataplane/) to learn more.

### List of data sources that use the data plane

As of October 2025, the following data sources send data plane data in at least some of their responses:

- Prometheus, including Amazon and Azure variants
- Loki
- Azure Monitor
- Azure Data Explorer
- BigQuery
- ClickHouse
- Cloudflare
- Databricks
- Influx
- MySQL
- New Relic
- Oracle
- Postgres
- Snowflake
- Victoria metrics

To see examples of data planes, refer to [data plane example data in GitHub](https://github.com/grafana/dataplane/tree/main/examples/data).

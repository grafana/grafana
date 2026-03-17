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
- [Introduction to the Grafana data structure](https://grafana.com/developers/dataplane/)
- [Grafana React components library](https://developers.grafana.com)
- [Grafana Scenes library](https://grafana.com/developers/scenes)

## The Grafana data model

Grafana supports a variety of different data sources, each with its own data model. To manage this, Grafana consolidates the query results from each of these data sources into one unified data structure called a **data frame**. The **data plane** adds a property layer to the data frame with information about the data frame type and what the data frame holds.

The data plane contract is a written set of rules that explain how producers of data (data sources, transformations) must form the frames, and how data consumers (like dashboards, alerting, and apps) can expect the data they receive to be like. In short, it describes the rules for valid and invalid schemas for each data frame type.

### Benefits

Besides interoperability, using data planes has other benefits.

If you're a developer and data source author, you know what type of frames to output, and authors of features know what to expect for their input. This makes the platform scalable and development more efficient and less frustrating due to incompatibilities.

In general, using the data plane makes Grafana more reliable, with everything working as expected. A solid data plane contract would help to suggest what to do with your data. For example, if you're using a specific type, Grafana could suggest creating alert rules or certain visualizations in dashboards that work well with that type. Similarly, Grafana could suggest transformations that get you from the current type to another type support additional actions.

## List of data sources that use the data plane

As of October 2025, the following data sources send data plane data in at least some of their responses:

- Prometheus, including Amazon and Azure variants
- Loki
- Azure Monitor
- Azure Data Explorer
- Bigquery
- Clickhouse
- Cloudlflare
- Databricks
- Influx
- MySQL
- New Relic
- Oracle
- Postgres
- Snowflake
- Victoria metrics

To see examples of data planes, refer to [data plane example data in GitHub](https://github.com/grafana/dataplane/tree/main/examples/data).

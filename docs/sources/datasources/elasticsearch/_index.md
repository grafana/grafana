---
aliases:
  - ../data-sources/elasticsearch/
  - ../features/datasources/elasticsearch/
description: Guide for using Elasticsearch in Grafana
keywords:
  - grafana
  - elasticsearch
  - guide
  - data source
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Elasticsearch
title: Elasticsearch data source
weight: 325
---

# Elasticsearch data source

[Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/elasticsearch-intro.html) is a search and analytics engine used for a variety of use cases. The built-in Elasticsearch data source lets you query and visualize logs or metrics stored in Elasticsearch, and annotate graphs with log events.

{{< admonition type="note" >}}
If you use Amazon OpenSearch Service (the successor to Amazon Elasticsearch Service), use the [OpenSearch data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opensearch/) instead.
{{< /admonition >}}

## Key capabilities

The Elasticsearch data source supports:

- **Metrics queries:** Aggregate and visualize numeric data using bucket and metric aggregations.
- **Log queries:** Search, filter, and explore log data with Lucene query syntax.
- **Annotations:** Overlay Elasticsearch events on your dashboard graphs.
- **Alerting:** Create alerts based on Elasticsearch query results.
- **ES|QL queries (experimental):** Query data using Elasticsearch's pipe-based query language.

## Before you begin

Before you configure the Elasticsearch data source, you need:

- An Elasticsearch instance (v7.17+, v8.x, or v9.x)
- Network access from Grafana to your Elasticsearch server
- Appropriate user credentials or API keys with read access

## Supported Elasticsearch versions

This data source supports these versions of Elasticsearch:

- ≥ v7.17
- v8.x
- v9.x
- Elastic Cloud Serverless

The Grafana maintenance policy for the Elasticsearch data source aligns with [Elastic Product End of Life Dates](https://www.elastic.co/support/eol). Grafana ensures proper functionality for supported versions only. If you use an EOL version of Elasticsearch, you can still run queries, but the query builder displays a warning. Grafana doesn't guarantee functionality or provide fixes for EOL versions.

## Get started

The following documentation helps you set up and use the Elasticsearch data source:

- [Configure the data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/configure/)
- [Query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/query-editor/)
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/template-variables/)
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/annotations/)
- [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/alerting/)
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/troubleshooting/)

## Plugin updates

Starting with Grafana v13.0, the Elasticsearch data source is a standalone plugin, pre-installed in both Grafana OSS and Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

## Additional resources

Once you have configured the Elasticsearch data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to run ad hoc queries against your Elasticsearch data.
- Configure and use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/template-variables/) for dynamic dashboards.
- Add [Transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to process query results.
- [Build dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/) to visualize your Elasticsearch data.

## Related data sources

- [OpenSearch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opensearch/) - For Amazon OpenSearch Service.
- [Loki](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/) - Grafana's log aggregation system.

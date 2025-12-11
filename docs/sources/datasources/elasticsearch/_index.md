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
refs:
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
---

# Elasticsearch data source

Elasticsearch is a search and analytics engine used for a variety of use cases.
You can create many types of queries to visualize logs or metrics stored in Elasticsearch, and annotate graphs with log events stored in Elasticsearch.

The following resources will help you get started with Elasticsearch and Grafana:

- [What is Elasticsearch?](https://www.elastic.co/guide/en/elasticsearch/reference/current/elasticsearch-intro.html)
- [Configure the Elasticsearch data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/configure/)
- [Elasticsearch query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/query-editor/)
- [Elasticsearch template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/template-variables/)
- [Elasticsearch annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/annotations/)
- [Elasticsearch alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/alerting/)
- [Troubleshooting issues with the Elasticsearch data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/troubleshooting/)

## Key capabilities

The Elasticsearch data source supports:

- **Metrics queries:** Aggregate and visualize numeric data using bucket and metric aggregations.
- **Log queries:** Search, filter, and explore log data with Lucene query syntax.
- **Annotations:** Overlay Elasticsearch events on your dashboard graphs.
- **Alerting:** Create alerts based on Elasticsearch query results.

## Before you begin

Before you configure the Elasticsearch data source, you need:

- An Elasticsearch instance (v7.17+, v8.x, or v9.x)
- Network access from Grafana to your Elasticsearch server
- Appropriate user credentials or API keys with read access

{{< admonition type="note" >}}
If you use Amazon OpenSearch Service (the successor to Amazon Elasticsearch Service), use the [OpenSearch data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opensearch/) instead.
{{< /admonition >}}

## Supported Elasticsearch versions

{{< admonition type="warning" >}}
The Elasticsearch data source plugin currently does not support Elastic Cloud Serverless, or any other serverless variant of Elasticsearch.
{{< /admonition >}}

This data source supports these versions of Elasticsearch:

- ≥ v7.17
- v8.x
- v9.x

The Grafana maintenance policy for the Elasticsearch data source aligns with [Elastic Product End of Life Dates](https://www.elastic.co/support/eol). Grafana ensures proper functionality for supported versions only. If you use an EOL version of Elasticsearch, you can still run queries, but the query builder displays a warning. Grafana doesn't guarantee functionality or provide fixes for EOL versions.

## Additional resources

Once you have configured the Elasticsearch data source, you can:

- Use [Explore](ref:explore) to run ad-hoc queries against your Elasticsearch data.
- Configure and use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/template-variables/) for dynamic dashboards.
- Add [Transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to process query results.
- [Build dashboards](ref:build-dashboards) to visualize your Elasticsearch data.

## Related data sources

- [OpenSearch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/opensearch/) - For Amazon OpenSearch Service.
- [Loki](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/) - Grafana's log aggregation system.

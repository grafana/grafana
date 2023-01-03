---
description: Data sources in Grafana Alerting
title: Data sources
weight: 100
---

# Data sources

There are a number of data sources that are compatible with Grafana Alerting. Each data source is supported by a plugin. You can use one of the built-in data sources listed below, use [external data source plugins](https://grafana.com/grafana/plugins/?type=datasource), or create your own data source plugin.

If you are creating your own data source plugin, make sure it is a backend plugin as Grafana Alerting requires this in order to be able to evaluate rules using the data source. Frontend data sources are not supported, because the evaluation engine runs on the backend.

Specifying { "alerting": true, “backend”: true } in the plugin.json file indicates that the data source plugin is compatible with Grafana Alerting and includes the backend data-fetching code. For more information, refer to [Build a data source backend plugin](https://grafana.com/tutorials/build-a-data-source-backend-plugin/).

These are the data sources that are compatible with and supported by Grafana Alerting.

- [AWS CloudWatch](https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/)
- [Azure Monitor](https://grafana.com/docs/grafana/latest/datasources/azuremonitor/)
- [Elasticsearch](https://grafana.com/docs/grafana/latest/datasources/elasticsearch/)
- [Google Cloud Monitoring](https://grafana.com/docs/grafana/latest/datasources/google-cloud-monitoring/)
- [Graphite](https://grafana.com/docs/grafana/latest/datasources/graphite/)
- [InfluxDB](https://grafana.com/docs/grafana/latest/datasources/influxdb/)
- [Loki](https://grafana.com/docs/grafana/latest/datasources/loki/)
- [Microsoft SQL Server MSSQL](https://grafana.com/docs/grafana/latest/datasources/mssql/)
- [MySQL](https://grafana.com/docs/grafana/latest/datasources/mysql/)
- [Open TSDB](https://grafana.com/docs/grafana/latest/datasources/opentsdb/)
- [PostgreSQL](https://grafana.com/docs/grafana/latest/datasources/postgres/)
- [Prometheus](https://grafana.com/docs/grafana/latest/datasources/prometheus/)
- [Jaeger](https://grafana.com/docs/grafana/latest/datasources/jaeger/)
- [Zipkin](https://grafana.com/docs/grafana/latest/datasources/zipkin/)
- [Tempo](https://grafana.com/docs/grafana/latest/datasources/tempo/)
- [Testdata](https://grafana.com/docs/grafana/latest/datasources/testdata/)

## Useful links

- [Grafana data sources](https://grafana.com/docs/grafana/latest/datasources/)
- [Add a data source](https://grafana.com/docs/grafana/latest/datasources/add-a-data-source/)

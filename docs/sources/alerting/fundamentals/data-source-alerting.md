---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/data-source-alerting/
description: Data sources in Grafana Alerting
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Data sources and Grafana Alerting
weight: 100
---

# Data sources and Grafana Alerting

There are a number of data sources that are compatible with Grafana Alerting. Each data source is supported by a plugin. You can use one of the built-in data sources listed below, use [external data source plugins](/grafana/plugins/?type=datasource), or create your own data source plugin.

If you are creating your own data source plugin, make sure it is a backend plugin as Grafana Alerting requires this in order to be able to evaluate rules using the data source. Frontend data sources are not supported, because the evaluation engine runs on the backend.

Specifying `{ "alerting": true, “backend”: true }` in the plugin.json file indicates that the data source plugin is compatible with Grafana Alerting and includes the backend data-fetching code. For more information, refer to [Build a data source backend plugin](/tutorials/build-a-data-source-backend-plugin/).

These are the data sources that are compatible with and supported by Grafana Alerting.

- [AWS CloudWatch][]
- [Azure Monitor][]
- [Elasticsearch][]
- [Google Cloud Monitoring][]
- [Graphite][]
- [InfluxDB][]
- [Loki][]
- [Microsoft SQL Server (MSSQL)][]
- [MySQL][]
- [Open TSDB][]
- [PostgreSQL][]
- [Prometheus][]
- [Jaeger][]
- [Zipkin][]
- [Tempo][]
- [Testdata][]

## Useful links

- [Grafana data sources][]

{{% docs/reference %}}
[Grafana data sources]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources"
[Grafana data sources]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources"

[AWS CloudWatch]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/aws-cloudwatch"
[AWS CloudWatch]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/aws-cloudwatch"

[Azure Monitor]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/azure-monitor"
[Azure Monitor]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/azure-monitor"

[Elasticsearch]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/elasticsearch"
[Elasticsearch]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/elasticsearch"

[Google Cloud Monitoring]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/google-cloud-monitoring"
[Google Cloud Monitoring]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/google-cloud-monitoring"

[Graphite]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/graphite"
[Graphite]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/graphite"

[InfluxDB]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/influxdb"
[InfluxDB]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/influxdb"

[Loki]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/loki"
[Loki]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/loki"

[Microsoft SQL Server (MSSQL)]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/mssql"
[Microsoft SQL Server (MSSQL)]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/mssql"

[MySQL]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/mysql"
[MySQL]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/mysql"

[Open TSDB]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/opentsdb"
[Open TSDB]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/opentsdb"

[PostgreSQL]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/postgres"
[PostgreSQL]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/postgres"

[Prometheus]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/prometheus"
[Prometheus]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/prometheus"

[Jaeger]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/jaeger"
[Jaeger]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/jaeger"

[Zipkin]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/zipkin"
[Zipkin]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/zipkin"

[Tempo]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/tempo"
[Tempo]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/tempo"

[Testdata]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/testdata"
[Testdata]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/testdata"
{{% /docs/reference %}}

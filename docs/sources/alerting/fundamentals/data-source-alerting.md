---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/data-source-alerting/
description: Data sources in Grafana Alerting
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Data sources
weight: 100
---

# Data sources for Alerting

There are a number of data sources that are compatible with Grafana Alerting. Each data source is supported by a plugin. You can use one of the built-in data sources listed below, use [external data source plugins](/grafana/plugins/?type=datasource), or create your own data source plugin.

If you are creating your own data source plugin, make sure it is a backend plugin as Grafana Alerting requires this in order to be able to evaluate rules using the data source. Frontend data sources are not supported, because the evaluation engine runs on the backend.

Specifying `{ "alerting": true, “backend”: true }` in the plugin.json file indicates that the data source plugin is compatible with Grafana Alerting and includes the backend data-fetching code. For more information, refer to [Build a data source backend plugin](/tutorials/build-a-data-source-backend-plugin/).

These are the data sources that are compatible with and supported by Grafana Alerting.

- [AWS CloudWatch][aws-cloudwatch]
- [Azure Monitor][azure-monitor]
- [Elasticsearch][elasticsearch]
- [Google Cloud Monitoring][google-cloud-monitoring]
- [Graphite][graphite]
- [InfluxDB][influxdb]
- [Loki][loki]
- [Microsoft SQL Server MSSQL][mssql]
- [MySQL][mysql]
- [Open TSDB][opentsdb]
- [PostgreSQL][postgres]
- [Prometheus][prometheus]
- [Jaeger][jaeger]
- [Zipkin][zipkin]
- [Tempo][tempo]
- [Testdata][testdata]

## Useful links

- [Grafana data sources][datasources]

{{% docs/reference %}}
[datasources]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources"

[aws-cloudwatch]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/aws-cloudwatch"
[aws-cloudwatch]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/aws-cloudwatch"

[azure-monitor]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/azure-monitor"
[azure-monitor]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/azure-monitor"

[elasticsearch]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/elasticsearch"
[elasticsearch]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/elasticsearch"

[google-cloud-monitoring]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/google-cloud-monitoring"
[google-cloud-monitoring]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/google-cloud-monitoring"

[graphite]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/graphite"
[graphite]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/graphite"

[influxdb]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/influxdb"
[influxdb]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/influxdb"

[loki]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/loki"
[loki]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/loki"

[mssql]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/mssql"
[mssql]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/mssql"

[mysql]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/mysql"
[mysql]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/mysql"

[opentsdb]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/opentsdb"
[opentsdb]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/opentsdb"

[postgres]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/postgres"
[postgres]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/postgres"

[prometheus]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/prometheus"
[prometheus]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/prometheus"

[jaeger]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/jaeger"
[jaeger]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/jaeger"

[zipkin]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/zipkin"
[zipkin]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/zipkin"

[tempo]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/tempo"
[tempo]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/tempo"

[testdata]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/testdata"
[testdata]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/datasources/testdata"
{{% /docs/reference %}}

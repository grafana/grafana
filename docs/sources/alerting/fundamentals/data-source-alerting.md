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
refs:
  elasticsearch:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/
  graphite:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/graphite/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/graphite/
  loki:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/
  postgresql:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/postgres/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/postgres/
  influxdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/
  testdata:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/testdata/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/testdata/
  grafana-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
  azure-monitor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/
  aws-cloudwatch:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/
  open-tsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/
  google-cloud-monitoring:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/
  tempo:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/
  microsoft-sql-server-(mssql):
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/
  mysql:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/
  prometheus:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/
  jaeger:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/
  zipkin:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/
---

# Data sources and Grafana Alerting

There are a number of data sources that are compatible with Grafana Alerting. Each data source is supported by a plugin. You can use one of the built-in data sources listed below, use [external data source plugins](/grafana/plugins/?type=datasource), or create your own data source plugin.

If you are creating your own data source plugin, make sure it is a backend plugin as Grafana Alerting requires this in order to be able to evaluate rules using the data source. Frontend data sources are not supported, because the evaluation engine runs on the backend.

Specifying `{ "alerting": true, “backend”: true }` in the plugin.json file indicates that the data source plugin is compatible with Grafana Alerting and includes the backend data-fetching code. For more information, refer to [Build a data source backend plugin](/tutorials/build-a-data-source-backend-plugin/).

These are the data sources that are compatible with and supported by Grafana Alerting.

- [AWS CloudWatch](ref:aws-cloudwatch)
- [Azure Monitor](ref:azure-monitor)
- [Elasticsearch](ref:elasticsearch)
- [Google Cloud Monitoring](ref:google-cloud-monitoring)
- [Graphite](ref:graphite)
- [InfluxDB](ref:influxdb)
- [Loki](ref:loki)
- [Microsoft SQL Server (MSSQL)](<ref:microsoft-sql-server-(mssql)>)
- [MySQL](ref:mysql)
- [Open TSDB](ref:open-tsdb)
- [PostgreSQL](ref:postgresql)
- [Prometheus](ref:prometheus)
- [Jaeger](ref:jaeger)
- [Zipkin](ref:zipkin)
- [Tempo](ref:tempo)
- [Testdata](ref:testdata)

## Useful links

- [Grafana data sources](ref:grafana-data-sources)

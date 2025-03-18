---
aliases:
  - ../data-sources/influxdb/
  - ../data-sources/influxdb/provision-influxdb/
  - ../features/datasources/influxdb/
  - provision-influxdb/
description: InfluxDB data source for Grafana
keywords:
  - grafana
  - influxdb
  - guide
  - flux
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: InfluxDB
title: InfluxDB data source
weight: 700
refs:
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  transformations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/
---

# InfluxDB data source

{{< docs/shared lookup="influxdb/intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

Grafana includes built-in support for InfluxDB. You do not have to install a plugin to add the InfluxDB data source.

Grafana offers multiple configuration options for the InfluxDB data source, including a choice of three query languages and a robust query editor that includes both a code editor and a visual query builder.

## Get started with the InfluxDB data source

The following documents will help you get started with the InfluxDB data source in Grafana:

- [Get started with Grafana and InfluxDB](/docs/grafana/<GRAFANA_VERSION>/getting-started/get-started-grafana-influxdb/)
- [Configure the InfluxDB data source](./configure-influxdb-data-source/)
- [InfluxDB query editor](./query-editor/)
- [InfluxDB templates and variables](./template-variables/)

Once you have configured the data source you can:

- Add [annotations](ref:annotations)
- Set up [alerting](ref:alerting)
- Add [transformations](ref:transformations)

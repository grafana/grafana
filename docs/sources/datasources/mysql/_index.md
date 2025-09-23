---
aliases:
  - ../data-sources/mysql/
  - ../features/datasources/mysql/
description: introduction to the MySQL data source in Grafana
keywords:
  - grafana
  - mysql
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: MySQL
title: MySQL data source
weight: 1000
refs:
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  configure-mysql-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/configuration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/configuration/
  mysql-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mysql/query-editor/
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

# MySQL data source

Grafana ships with a built-in MySQL data source plugin that allows you to query and visualize data from a MySQL-compatible database like MariaDB or Percona Server. You don't need to install a plugin in order to add the MySQL data source to your Grafana instance.

Grafana offers several configuration options for this data source as well as a visual and code-based query editor.

## Get started with the MySQL data source

The following documents will help you get started with the MySQL data source in Grafana:

- [Configure the MySQL data source](ref:configure-mysql-data-source)
- [MySQL query editor](ref:mysql-query-editor)

Once you have configured the data source you can:

- Add [annotations](ref:annotate-visualizations)
- Set up [alerting](ref:alerting)
- Add [transformations](ref:transformations)

View a MySQL overview on Grafana Play:

{{< docs/play title="MySQL Overview" url="https://play.grafana.org/d/edyh1ib7db6rkb/mysql-overview" >}}

---
aliases:
  - ../data-sources/mssql/
  - ../features/datasources/mssql/
description: Guide for using Microsoft SQL Server in Grafana
keywords:
  - grafana
  - MSSQL
  - Microsoft
  - SQL
  - guide
  - Azure SQL Database
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Microsoft SQL Server
title: Microsoft SQL Server data source
weight: 900
refs:
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  add-template-variables-interval-ms:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval_ms
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval_ms
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  add-template-variables-interval:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  transformations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  set-up-grafana-monitoring:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/
  configure-mssql-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure
  mssql-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/
  mssql-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/mssql/template-variables/
  query-caching:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching
---

# Microsoft SQL Server (MSSQL) data source

Grafana ships with built-in support for Microsoft SQL Server (MSSQL).
You can query and visualize data from any Microsoft SQL Server 2005 or newer, including the Microsoft Azure SQL Database.

Use this data source to create dashboards, explore SQL data, and monitor MSSQL-based workloads in real time.

The following documentation helps you get started working with the Microsoft SQL Server (MSSQL) data source:

- [Configure the Microsoft SQL Server data source](ref:configure-mssql-data-source)
- [Microsoft SQL Server query editor](ref:mssql-query-editor)
- [Microsoft SQL Server template variables](ref:mssql-template-variables)

## Get the most out of the data source

After installing and configuring the Microsoft SQL Server data source, you can:

- Create a wide variety of [visualizations](ref:visualizations)
- Configure and use [templates and variables](ref:variables)
- Add [transformations](ref:transformations)
- Add [annotations](ref:annotate-visualizations)
- Set up [alerting](ref:alerting)
- Optimize performance with [query caching](ref:query-caching)

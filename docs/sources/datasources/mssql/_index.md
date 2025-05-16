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
---

# Microsoft SQL Server (MSSQL) data source

Grafana ships with built-in support for Microsoft SQL Server (MS SQL).
You can query and visualize data from any Microsoft SQL Server 2005 or newer, including Microsoft Azure SQL Database.

This topic explains configuration specific to the Microsoft SQL Server data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML](#provision-the-data-source) with Grafana's provisioning system.

Once you've added the Microsoft SQL Server data source, you can [configure it](#configure-the-data-source) so that your Grafana instance's users can create queries in its [query editor](query-editor/) when they [build dashboards](ref:build-dashboards) and use [Explore](ref:explore).



## Query the data source

You can create queries with the Microsoft SQL Server data source's query editor when editing a panel that uses a MS SQL data source.

For details, refer to the [query editor documentation](query-editor/).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation](template-variables/).

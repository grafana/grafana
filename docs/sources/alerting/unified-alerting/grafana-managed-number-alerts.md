+++
title = "Numeric data Grafana manged alert rules"
description = "Number data based Grafana manged alert rules"
keywords = ["grafana", "alerting", "guide", "rules", "create"]
weight = 400
+++

# Alerting on numeric data

With certain datasources non-timeseries data can be directly alerted on, or passed into Server Side Expressions (SSE). This allows for more efficiency by doing more processing within the data source, and can also simplify alert rules.

When alerting on numeric data instead of timeseries data, there is no need to reduce each labeled time series into a single number. Instead labeled numbers are returned to Grafana instead.

## Tabular Data

This feature is supported with backend data sources that query tabular data:
 - SQL Datasources such as MySQL, Postgres, MSSQL, and Oracle.
 - The Azure Kusto based services: Azure Monitor (Logs), Azure Monitor (Azure Resource Graph), and Azure Data Explorer.

A query with Grafana managed alerts or SSE is considered numeric with these datasources if:
 - The "Format AS" option is a table.
 - The table response returned to Grafana from the query includes only one numeric (e.g. int, double, float) column, and optionally additional string columns.

If there are string columns then those columns become labels. The name of column becomes the label name, and the value for each row becomes the value of the corresponding label. If multiple rows are returned, then each row should be uniquely identified their labels.

## Example


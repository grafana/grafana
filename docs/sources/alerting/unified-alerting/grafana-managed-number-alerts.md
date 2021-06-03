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

If you have a MySQL table called "DiskSpace" like the following:

| Time        | Host | Disk | PercentFree
| ----------- | ---  | -----| --------
| 2021-June-7 | web1 | /etc | 3
| 2021-June-7 | web2 | /var | 4
| 2021-June-7 | web3 | /var | 8
| ...         | ...  | ...  | ...

You can query this data filtering on time, but without returning time series to Grafana:

```sql
SELECT Host, Disk, CASE WHEN PercentFree < 5.0 THEN PercentFree ELSE 0 END FROM (
  SELECT 
      Host, 
      Disk, 
      Avg(PercentFree) 
  FROM DiskSpace
  Group By 
    Host, 
    Disk
  Where __timeFilter(Time)
```

This query would return the following Table response to Grafana:

| Host | Disk | PercentFree
| ---  | -----| --------
| web1 | /etc | 3
| web2 | /var | 4
| web3 | /var | 0

When this query is used as the **condition** in an alert rule, the non-zero will be alerting. So three alert instances will be produced:

| Labels                | Status 
| ----------------------| ------
| {Host=web1,disk=/etc} | Alerting
| {Host=web2,disk=/var} | Alerting
| {Host=web3,disk=/var} | Normal 
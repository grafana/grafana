---
canonical: https://grafana.com/docs/grafana/latest/alerting/best-practices/table-data
description: This example shows how to create an alert rule using table data.
keywords:
  - grafana
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Examples of table data
title: Example of alerting on tabular data
weight: 1102
refs:
  testdata-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/testdata/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/testdata/
  multi-dimensional-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/multi-dimensional-alerts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/multi-dimensional-alerts/
  infinity-csv:
    - pattern: /docs/grafana/
      destination: /docs/plugins/yesoreyeram-infinity-datasource/latest/csv/
---

# Example of alerting on tabular data

Not all data sources return time series data. SQL databases, CSV files, and some APIs often return results as rows or arrays of columns or fields — commonly referred to as tabular data.

This example shows how to create an alert rule using data in table format. Grafana treats each row as a separate alert instance, as long as the data meets the expected format.

## How Grafana Alerting evaluates tabular data

When a query returns data in table format, Grafana transforms each row into a separate alert instance.

To evaluate each row (alert instance), it expects:

1. **Only one numeric column.** This is the value used for evaluating the alert condition.
1. **Non-numeric columns.** These columns defines the label set. The column name becomes a label name; and the cell value becomes the label value.
1. **Unique label sets per row.** Each row must be uniquely identifiable by its labels. This ensures each row represents a distinct alert instance.

{{< admonition type="caution" >}}
These three conditions must be met—otherwise, Grafana can’t evaluate the table data and the rule will fail.
{{< /admonition >}}

## Example overview

Imagine you store disk usage in a `DiskSpace` table and you want to trigger alerts when the available space drops below 5%.

| Time       | Host | Disk | PercentFree |
| ---------- | ---- | ---- | ----------- |
| 2021-06-07 | web1 | /etc | 3           |
| 2021-06-07 | web2 | /var | 4           |
| 2021-06-07 | web3 | /var | 8           |

To calculate the free space per Host and Disk in this case, you can use `$__timeFilter` to filter by time but without returning the date to Grafana:

```sql
SELECT
  Host,
  Disk,
  AVG(PercentFree) AS PercentFree
FROM DiskSpace
WHERE $__timeFilter(Time)
GROUP BY Host, Disk
```

This query returns the following table response:

| Host | Disk | PercentFree |
| ---- | ---- | ----------- |
| web1 | /etc | 3           |
| web2 | /var | 4           |
| web3 | /var | 8           |

When Alerting evaluates the query response, the data is transformed into three alert instances as previously detailed:

- The numeric column becomes the value for the alert condition.
- Additional columns define the label set for each alert instance.

| Alert instance               | Value |
| ---------------------------- | ----- |
| `{Host="web1", Disk="/etc"}` | 3     |
| `{Host="web2", Disk="/var"}` | 4     |
| `{Host="web3", Disk="/var"}` | 8     |

Finally, an alert condition that checks for less than 5% of free space (`$A < 5`) would result in two alert instances firing:

| Alert instance               | Value | State  |
| ---------------------------- | ----- | ------ |
| `{Host="web1", Disk="/etc"}` | 3     | Firing |
| `{Host="web2", Disk="/var"}` | 4     | Firing |
| `{Host="web3", Disk="/var"}` | 8     | Normal |

## Try it with TestData

To test this quickly, you can simulate the table using the [**TestData** data source](ref:testdata-data-source):

1. Add the **TestData** data source through the **Connections** menu.
1. Go to **Alerting** and create an alert rule
1. Select **TestData** as the data source.
1. From **Scenario**, select **CSV Content** and paste this CSV:

   ```bash
   host, disk, percentFree
   web1, /etc, 3
   web2, /var, 4
   web3, /var, 8
   ```

1. Set a condition like `$A < 5` and **Preview** the alert.

   Grafana evaluates the table data and fires the two first alert instances.

   {{< figure src="/media/docs/alerting/example-table-data-preview.png" max-width="750px" alt="Alert preview with tabular data using the TestData data source" >}}

   {{< docs/play title="this alert example" url="https://play.grafana.org/alerting/grafana/eep7osljocvswa/view" >}}

## CSV data with Infinity

Note that when the [Infinity plugin fetches CSV data](ref:infinity-csv), all the columns are parsed and returned as strings. By default, this causes the query expression to fail in Alerting.

To make it work, you need to format the CSV data as [expected by Grafana Alerting](#how-grafana-alerting-evaluates-tabular-data).

In the query editor, specify the column names and their types to ensure that only one column is treated as a number.

{{< figure src="/media/docs/alerting/example-table-data-infinity-csv-data.png" max-width="750px" alt="Using the Infinity data source plugin to fetch CSV data in Alerting" >}}

## Differences with time series data

Working with time series is similar—each series is treated as a separate alert instance, based on its label set.

The key difference is the data format:

- **Time series data** contains multiple values over time, each with its own timestamp.
  To evaluate the alert condition, alert rules **must reduce each series to a single number** using a function like `last()`, `avg()`, or `max()`.
- **Tabular data** doesn’t require reduction, as each row contains only a single numeric value used to evaluate the alert condition.

For comparison, see the [multi-dimensional time series data example](ref:multi-dimensional-example).
